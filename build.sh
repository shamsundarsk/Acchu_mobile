#!/bin/bash
set -e

echo "Building shared-types..."
cd packages/shared-types
npm run build
cd ../..

echo "Building customer-system..."
cd packages/customer-system
npm run build
cd ../..

echo "Build completed successfully!"