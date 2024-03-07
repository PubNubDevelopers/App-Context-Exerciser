//  Todo Test if App Context is enabled on the keyset

var publish_key = "";
var subscribe_key = "";
var pubnub;
var subscriptionSet;
var userCache;
var channelCache;
var membershipCache;

function editKeys() {
  //  Enable the key input dialogs
  document.getElementById("txtPublishKey").disabled = false;
  document.getElementById("txtSubscribeKey").disabled = false;

  document.getElementById("btnEditPubNubKeys").style.display = "none";
  document.getElementById("btnSavePubNubKeys").style.display = "flex";

  pubnub = null;
  document.getElementById("users").innerHTML = "";
  document.getElementById("channels").innerHTML = "";
  document.getElementById("memberships").innerHTML = "";
}

async function saveKeys() {
  var publishEdit = document.getElementById("txtPublishKey");
  var subscribeEdit = document.getElementById("txtSubscribeKey");
  var publishKey = publishEdit.value;
  var subscribeKey = subscribeEdit.value;

  if (!publishKey.startsWith("pub-c-")) {
    publishEdit.focus();
    return;
  }
  if (!subscribeKey.startsWith("sub-c-")) {
    subscribeEdit.focus();
    return;
  }

  document.getElementById("btnEditPubNubKeys").style.display = "flex";
  document.getElementById("btnSavePubNubKeys").style.display = "none";
  publishEdit.disabled = true;
  subscribeEdit.disabled = true;
  publish_key = publishKey;
  subscribe_key = subscribeKey;
  await load();
}

function init() {
  document
    .getElementById("refreshDataButton")
    .addEventListener("click", function () {
      refreshData();
    });
  document
    .getElementById("explanatoryTextClose")
    .addEventListener("click", function () {
      document.getElementById("explanatoryText").style.display = "none";
    });
  document
    .getElementById("btnEditPubNubKeys")
    .addEventListener("click", function () {
      editKeys();
    });
  document
    .getElementById("btnSavePubNubKeys")
    .addEventListener("click", function () {
      saveKeys();
    });
}

async function load() {
  pubnub = await createPubNubObject();
  userCache = [];
  channelCache = [];
  membershipCache = [];

  //  Set my own UUID meta data to something more recognizable
  try {
    await pubnub.objects.getUUIDMetadata({ uuid: pubnub.getUUID() });
  } catch {
    //  The current user has no meta data associated with them, give them some.
    await pubnub.objects.setUUIDMetadata({
      data: {
        name: "App Context Toolkit Exerciser",
        custom: {
          info: "User for App Context Toolkit testing",
        },
      },
      include: { customFields: true },
    });
  }

  await refreshData();
  if (!subscriptionSet) return;

  subscriptionSet.addListener({
    objects: async (objectEvent) => {
      console.log(objectEvent)
      if (
        objectEvent.message.type === "uuid" &&
        objectEvent.message.event === "set"
      ) {
        //  A user's metadata has been updated
        addUserToUI(objectEvent.message.data);
      } else if (
        objectEvent.message.type === "uuid" &&
        objectEvent.message.event === "delete"
      ) {
        //  A user has been deleted
        userDeleted(objectEvent.message.data);
        //  It should be fixed prior to release but currently need to refresh to update memberships
        dataNeedsRefreshing();
      } else if (
        objectEvent.message.type === "channel" &&
        objectEvent.message.event === "set"
      ) {
        addChannelToUI(objectEvent.message.data);
      } else if (
        objectEvent.message.type === "channel" &&
        objectEvent.message.event === "delete"
      ) {
        //  A channel has been deleted
        channelDeleted(objectEvent.message.data);
        //  It should be fixed prior to release but currently need to refresh to update memberships
        dataNeedsRefreshing();
      } else if (
        objectEvent.message.type === "membership" &&
        objectEvent.message.event === "set"
      ) {
        //  A new user has been added to a channel we are a member of
        createMembership(
          objectEvent.message.data.uuid.id,
          objectEvent.message.data.channel.id
        );
        if (!userCache.includes(objectEvent.message.data.uuid.id)) {
          console.log("Unrecognized user.  Data requires refresh");
          dataNeedsRefreshing();
        }
        if (!channelCache.includes(objectEvent.message.data.channel.id)) {
          console.log("Unrecognized channel.  Data requires refresh");
          dataNeedsRefreshing();
        }
      } else if (
        objectEvent.message.type === "membership" &&
        objectEvent.message.event === "delete"
      ) {
        //  A user has been removed from a channel we are a member of
        deleteMembership(
          objectEvent.message.data.uuid.id,
          objectEvent.message.data.channel.id
        );
      }
    },
  });
}

async function refreshData() {
  if (!pubnub) return;
  document.getElementById("refreshDataWarning").style.display = "none";
  document.getElementById("users").innerHTML = "";
  document.getElementById("channels").innerHTML = "";
  document.getElementById("memberships").innerHTML = "";
  userCache = [];
  channelCache = [];
  membershipCache = [];
  //  Read the most recent 50 channels and set this app as a member of these
  await pubnub.objects
    .getAllChannelMetadata({
      include: { customFields: true },
      sort: { updated: "desc" },
      limit: 50,
    })
    .then(async (channels) => {
      //console.log(channels)
      if (channels.data.length > 0) {
        var channelsArray = [];
        for (var i = 0; i < channels.data.length; i++) {
          channelsArray.push(channels.data[i].id);
          addChannelToUI(channels.data[i]);
        }
        //  Join all the channels
        await pubnub.objects.setMemberships({
          channels: channelsArray,
        });
        subscriptionSet = pubnub.subscriptionSet({ channels: channelsArray });
        await subscriptionSet.subscribe();
      } else {
        //  No Channels in App Context, create some test channels
        await createTestChannels();
      }
    });

  await pubnub.objects
    .getAllUUIDMetadata({
      include: { customFields: true },
      sort: { updated: "desc" },
      limit: 50,
    })
    .then(async (users) => {
      //console.log(users)
      if (users.data.length > 0) {
        for (var i = 0; i < users.data.length; i++) {
          addUserToUI(users.data[i]);

          //  Populate the memberships
          //  This is giving me channels I already deleted using the App Context Toolkit
          const userMemberships = await pubnub.objects.getMemberships({
            uuid: users.data[i].id,
            sort: { updated: "desc" },
            limit: 50,
            include: {
              channelFields: true,
              customFields: true,
              statusField: true,
              channelStatusField: true,
              channelTypeField: true,
            },
          });
          for (var j = 0; j < userMemberships.data.length; j++) {
            //  There is a current bug which will be fixed prior to launch where
            //  memberships aren't always deleted properly in App Context - this will be
            //  fixed prior to launch but protect against that here.
            if (channelCache.includes(userMemberships.data[j].channel.id)) {
              createMembership(
                users.data[i].id,
                userMemberships.data[j].channel.id
              );
            }
          }
        }
      } else {
        //  No Users in App Context, this should not happen, at the
        //  very least this app will be there as a user, or if it is
        //  a brand new keyset, some dummy users were also created
      }
    });
}

async function createPubNubObject() {
  var savedUUID = null;
  var UUID;
  try {
    savedUUID = sessionStorage.getItem("userId");
  } catch (err) {
    console.log("Session storage is unavailable");
  } //  Session storage not available
  if (!savedUUID) {
    UUID = makeid(6); // Make new UUID
  } else {
    UUID = savedUUID;
  }
  try {
    sessionStorage.setItem("userId", UUID);
  } catch (err) {} //  Session storage is not available

  //  Publish and Subscribe keys are retrieved from keys.js
  var pubnub = new PubNub({
    publishKey: publish_key,
    subscribeKey: subscribe_key,
    userId: UUID,
  });
  return pubnub;
}

function makeid(length) {
  var result = "";
  var characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (var i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

async function createTestChannels() {
  var channelsArray = [];
  for (var i = 1; i < 4; i++) {
    channelsArray.push("testchannel_" + i);
    await pubnub.objects.setChannelMetadata({
      channel: "testchannel_" + i,
      data: {
        name: "Test Channel " + i,
        description: "Dummy Channel " + i,
        custom: {
          favNumber: i,
        },
      },
    });
  }
  //  Create 2 test users and add them to the newly created channels
  for (var i = 1; i < 3; i++) {
    await pubnub.objects.setUUIDMetadata({
      uuid: "user_" + i,
      data: {
        name: "Test User " + i,
        email: "user" + i + "@email.com",
        externalId: "" + (i + 500),
        custom: {
          IQ: 100 + i,
        },
      },
    });
    await pubnub.objects.setMemberships({
      uuid: "user_" + i,
      channels: channelsArray,
    });
  }
  load();
}

function addChannelToUI(channelData) {
  channelCache.push(channelData.id);
  var channelElement = document.getElementById(channelData.id + "-channel");
  var channelId = channelData.id;
  var channelName = channelData.name;
  if (channelName === null) {
    channelName = "Not Specified";
  } //  text deleted
  var channelDescription = channelData.description;
  if (channelDescription === null) {
    channelDescription = "Not Specified";
  }
  var channelType = channelData.type;
  if (channelType === null) {
    channelType = "Not Specified";
  }
  var channelStatus = channelData.status;
  if (channelStatus === null) {
    channelStatus = "Not Specified";
  }
  var channelCustom = channelData.custom;
  if (channelElement) {
    //  The channel already exists on the page
    console.log(channelCustom)
    if (channelCustom) {
      //  Updating custom channel fields
      var channelCustomDiv = document.getElementById(
        channelId + "-customFields"
      );
      console.log(channelCustomDiv)
      if (channelCustomDiv) {
        console.log('updating channel custom data')
        channelCustomDiv.innerHTML = generateCustomDataRow(channelCustom);
      }
    }
    //  Updating standard (non-custom) channel fields.  We are only told about fields that
    //  have changed
    if (channelName) {
        console.log('updating channel name')
      var channelNameDiv = document.getElementById(channelId + "-channelName");
      channelNameDiv.innerHTML = channelName;
    }
    if (channelDescription) {
      var channelDescriptionDiv = document.getElementById(
        channelId + "-channelDescription"
      );
      channelDescriptionDiv.innerHTML = channelDescription;
    }
    if (channelType) {
      var channelTypeDiv = document.getElementById(channelId + "-channelType");
      channelTypeDiv.innerHTML = channelType;
    }
    if (channelStatus) {
      var channelStatusDiv = document.getElementById(
        channelId + "-channelStatus"
      );
      channelStatusDiv.innerHTML = channelStatus;
    }
  } else {
    if (!channelName) {
      channelName = "Not Specified";
    }
    if (!channelDescription) {
      channelDescription = "Not Specified";
    }
    if (!channelType) {
      channelType = "Not Specified";
    }
    if (!channelStatus) {
      channelStatus = "Not Specified";
    }
    var customFields = "";
    if (!channelCustom) {
      customFields = `<div class="contextObjectRow">No Custom Fields Specified</div>`;
    } else {
      //  There is custom data in the channel
      customFields = generateCustomDataRow(channelCustom);
    }
    var channelObject = `
        <div id="${channelId}-channel" class="contextObject whiteBox">
                    <div class="contextObjectRow">
                        <div class="contextHeading">ID:</div><div id="${channelId}-channelId" class="contextData">${channelId}</div>
                    </div>
                    <div class="contextObjectRow">
                        <div class="contextHeading">Name:</div><div id="${channelId}-channelName" class="contextData">${channelName}</div>
                    </div>
                    <div class="contextObjectRow">
                        <div class="contextHeading">Description</div><div id="${channelId}-channelDescription" class="contextData">${channelDescription}</div>
                    </div>
                    <div class="contextObjectRow">
                        <div class="contextHeading">Type</div><div id="${channelId}-channelType" class="contextData">${channelType}</div>
                    </div>
                    <div class="contextObjectRow">
                        <div class="contextHeading">Status</div><div id="${channelId}-channelStatus" class="contextData">${channelStatus}</div>
                    </div>
                    <div class="contextObjectSection">Custom Fields</div>
                    <div id="${channelId}-customFields"> 
                        ${customFields}
                    </div>
                </div>
        `;
    var channelList = document.getElementById("channels");
    channelList.innerHTML += channelObject;
  }
}

function channelDeleted(channelData) {
  //  Deleted channel ID is channelData.id
  var channelElement = document.getElementById(channelData.id + "-channel");
  if (!channelElement) return;
  channelElement.remove();
  const cacheIndex = channelCache.indexOf(channelData.id);
  if (cacheIndex >= 0) {
    channelCache.splice(cacheIndex, 1);
  }
}

function addUserToUI(userData) {
  userCache.push(userData.id);
  var channelElement = document.getElementById(userData.id + "-user");
  var userId = userData.id;
  var userName = userData.name;
  if (userName === null) {
    userName = "Not Specified";
  }
  var userEmail = userData.email;
  if (userEmail === null) {
    userEmail = "Not Specified";
  }
  var userProfileUrl = userData.profileUrl;
  if (userProfileUrl === null) {
    userProfileUrl = "Not Specified";
  }
  var userExternalId = userData.externalId;
  if (userExternalId === null) {
    userExternalId = "Not Specified";
  }
  var userType = userData.type;
  if (userType === null) {
    userType = "Not Specified";
  }
  var userStatus = userData.status;
  if (userStatus === null) {
    userStatus = "Not Specified";
  }
  var userCustom = userData.custom;
  if (channelElement) {
    //  The user already exists on the page
    if (userCustom) {
      //  Updating custom user fields
      var userCustomDiv = document.getElementById(userId + "-customFields");
      userCustomDiv.innerHTML = generateCustomDataRow(userCustom);
    }
    //  Updating standard (non-custom) user fields.  We are only told about fields that
    //  have changed
    if (userName) {
      var userNameDiv = document.getElementById(userId + "-userName");
      userNameDiv.innerHTML = userName;
    }
    if (userEmail) {
      var userEmailDiv = document.getElementById(userId + "-userEmail");
      userEmailDiv.innerHTML = userEmail;
    }
    if (userProfileUrl) {
      var userProfileUrlDiv = document.getElementById(
        userId + "-userProfileUrl"
      );
      userProfileUrlDiv.innerHTML = userProfileUrl;
    }
    if (userExternalId) {
      var userExternalIdDiv = document.getElementById(
        userId + "-userExternalId"
      );
      userExternalIdDiv.innerHTML = userExternalId;
    }
    if (userType) {
      var userTypeDiv = document.getElementById(userId + "-userType");
      userTypeDiv.innerHTML = userType;
    }
    if (userStatus) {
      var userStatusDiv = document.getElementById(userId + "-userStatus");
      userStatusDiv.innerHTML = userStatus;
    }
  } else {
    if (!userName) {
      userName = "Not Specified";
    }
    if (!userEmail) {
      userEmail = "Not Specified";
    }
    if (!userProfileUrl) {
      userProfileUrl = "Not Specified";
    }
    if (!userExternalId) {
      userExternalId = "Not Specified";
    }
    if (!userType) {
      userType = "Not Specified";
    }
    if (!userStatus) {
      userStatus = "Not Specified";
    }
    var customFields = "";
    if (!userCustom) {
      customFields = `<div class="contextObjectRow">No Custom Fields Specified</div>`;
    } else {
      //  There is custom data in the channel
      customFields = generateCustomDataRow(userCustom);
    }
    var userObject = `
        <div id="${userId}-user" class="contextObject whiteBox">
        <div class="contextObjectRow">
            <div class="contextHeading">ID:</div><div id="${userId}-userId" class="contextData">${userId}</div>
        </div>
        <div class="contextObjectRow">
            <div class="contextHeading">Name:</div><div id="${userId}-userName" class="contextData">${userName}</div>
        </div>
        <div class="contextObjectRow">
            <div class="contextHeading">Email</div><div id="${userId}-userEmail" class="contextData">${userEmail}</div>
        </div>
        <div class="contextObjectRow">
            <div class="contextHeading">Profile URL</div><div id="${userId}-userProfileUrl" class="contextData">${userProfileUrl}</div>
        </div>
        <div class="contextObjectRow">
            <div class="contextHeading">External ID</div><div id="${userId}-userExternalId" class="contextData">${userExternalId}</div>
        </div>
        <div class="contextObjectRow">
            <div class="contextHeading">Type</div><div id="${userId}-userType" class="contextData">${userType}</div>
        </div>
        <div class="contextObjectRow">
            <div class="contextHeading">Status</div><div id="${userId}-userStatus" class="contextData">${userStatus}</div>
        </div>
        <div class="contextObjectSection">Custom Fields</div>
            <div id="${userId}-customFields"> 
            ${customFields}
            </div>
        </div>
        `;
    var userList = document.getElementById("users");
    userList.innerHTML += userObject;
  }
}

function userDeleted(userData) {
  //  Deleted user ID is userData.id
  var userElement = document.getElementById(userData.id + "-user");
  if (!userElement) return;
  userElement.remove();
  const cacheIndex = userCache.indexOf(userData.id);
  if (cacheIndex >= 0) {
    userCache.splice(cacheIndex, 1);
  }
}

function generateCustomDataRow(userCustom) {
  var customFields = "";
  for (var i = 0; i < Object.keys(userCustom).length; i++) {
    var customDataRow = `
        <div class="contextObjectRow">
            <div class="contextHeading">${
              Object.keys(userCustom)[i]
            }</div><div class="contextData">${
      userCustom[Object.keys(userCustom)[i]]
    }</div>
        </div>
        `;
    customFields += customDataRow;
  }
  return customFields;
}

function createMembership(userId, channelId) {
  var uniqueId = userId + "-" + channelId + "-channel";
  if (membershipCache.includes(uniqueId)) {
    return;
  }
  membershipCache.push(uniqueId);
  var membershipObject = `
        <div id="${userId}-${channelId}-membership" class="contextObject whiteBox">
            <div class="contextObjectRow">
                <div class="contextDataMembership">User <span class="code">${userId}</span> is a member of Channel <span class="code">${channelId}</code></div>
            </div>
        </div>
        `;

  var membershipList = document.getElementById("memberships");
  membershipList.innerHTML += membershipObject;
}

function deleteMembership(userId, channelId) {
  var membershipElement = document.getElementById(
    userId + "-" + channelId + "-membership"
  );
  membershipElement.remove();
}

function dataNeedsRefreshing() {
  //  Either warn the user to refresh manually, or automatically refresh
  //document.getElementById('refreshDataWarning').style.display = "flex";
  refreshData();
}
