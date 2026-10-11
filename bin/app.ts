#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { BranchLocationServiceStack } from '../lib/branch-location-service-stack';

const app = new cdk.App();
new BranchLocationServiceStack(app, 'BranchLocationServiceStack', {});