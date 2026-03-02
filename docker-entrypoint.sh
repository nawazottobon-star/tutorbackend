#!/bin/sh
set -e

echo "Starting backend entrypoint..."

# Generate Prisma client at runtime to ensure it's always ready
echo "Generating Prisma Client..."
npx prisma generate

# Execute the main command (starts the server)
echo "Starting application..."
exec "$@"
