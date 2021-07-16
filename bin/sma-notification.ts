#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { SMANotification } from '../lib/sma-notification';
import { AsteriskEndpoint } from '../lib/sma-testAsterisk';

const app = new cdk.App();

new SMANotification(app, 'SMANotification');
new AsteriskEndpoint(app, 'AsteriskEndpoint')
