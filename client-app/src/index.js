import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';
import App from './App.js';
import Amplify from 'aws-amplify'
import cdkExports from './cdk-outputs.json'

Amplify.configure({
  aws_appsync_region: "us-east-1", // (optional) - AWS AppSync region
  aws_appsync_graphqlEndpoint: cdkExports.SMANotification.graphQLURL, // (optional) - AWS AppSync endpoint
  aws_appsync_authenticationType: "API_KEY", // (optional) - Primary AWS AppSync authentication type
  aws_appsync_apiKey: cdkExports.SMANotification.graphQLKey // (optional) - AWS AppSync API Key
});


ReactDOM.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  document.getElementById('root')
);

