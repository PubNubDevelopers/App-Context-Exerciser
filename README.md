# App Context Exerciser

> Simple JavaScript application to show the principles of the User Management and Channel Management features of BizOps Workspace

**This application is provided without guarantee or warranty**

This application is designed to demonstrate the following [BizOps Workspace](https://pubnub.com/docs/bizops-workspace/basics) features:

- User Management
- Channel Management

To use this demo, you need the following prerequisites:

- A PubNub account with a paid pricing plan
- A newly generated keyset to hand.  Although you could use an existing keyset with this demo, since it adds user metadata to the keyset, **I would recommend using a dedicated keyset to play with this demo instead**.

![Screenshot](https://raw.githubusercontent.com/PubNubDevelopers/App-Context-Exerciser/main/media/screenshot3.png)

## Demo

A hosted version of this demo can be found at [https://pubnubdevelopers.github.io/App-Context-Exerciser/](https://pubnubdevelopers.github.io/App-Context-Exerciser/)

## Installing / Getting Started

- Generate a new keyset
- **Enable App Context on that keyset**, along with the user, channel, and membership events.
- Launch the demo
- Provide the Publish and Subscribe key to the app and click `save`
- Some test channels and users will be generated for you
- Log into [http://admin.pubnub.com](http://admin.pubnub.com) and select the keyset you created in the first step, and expand the `BizOps Workspace` menu on the left hand side.
- Select `User Management`.  You can modify the existing users and see their attributes update on the demo app.  You can create new users **and create a membership for them in one of the test channels** to see the new users appear on the demo app.
- Select `Channel management`.  You can modify the existing channels and see their attributes update on the demo app.  You can create new channels, but remember to **create a membership** between an existing user and this new channel to make the channel appear on the demo app (or, there is a 'Refresh Data' button on the app if you want to force an update) 

## Contributing
Please fork the repository if you'd like to contribute. Pull requests are always welcome. 

