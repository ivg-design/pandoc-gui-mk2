#!/bin/bash
# Version bump script for Pandoc GUI
# Usage: ./scripts/bump-version.sh [patch|minor|major]

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get the bump type from argument or detect from commit message
BUMP_TYPE=${1:-""}

if [ -z "$BUMP_TYPE" ]; then
    # Try to detect from git commit message flags: --patch, --minor, --major
    COMMIT_MSG=$(git log -1 --pretty=%B 2>/dev/null || echo "")
    if echo "$COMMIT_MSG" | grep -qE "\-\-patch\b"; then
        BUMP_TYPE="patch"
    elif echo "$COMMIT_MSG" | grep -qE "\-\-minor\b"; then
        BUMP_TYPE="minor"
    elif echo "$COMMIT_MSG" | grep -qE "\-\-major\b"; then
        BUMP_TYPE="major"
    fi
fi

if [ -z "$BUMP_TYPE" ]; then
    echo -e "${YELLOW}No version bump type specified. Use: patch, minor, or major${NC}"
    echo "Or add --patch, --minor, or --major flag to your commit message"
    exit 0
fi

echo -e "${GREEN}Bumping version: ${BUMP_TYPE}${NC}"

# Get current version from package.json
CURRENT_VERSION=$(node -p "require('./package.json').version")
echo "Current version: $CURRENT_VERSION"

# Parse version components
IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT_VERSION"

# Calculate new version
case $BUMP_TYPE in
    major)
        NEW_VERSION="$((MAJOR + 1)).0.0"
        ;;
    minor)
        NEW_VERSION="${MAJOR}.$((MINOR + 1)).0"
        ;;
    patch)
        NEW_VERSION="${MAJOR}.${MINOR}.$((PATCH + 1))"
        ;;
    *)
        echo -e "${RED}Invalid bump type: $BUMP_TYPE${NC}"
        echo "Use: patch, minor, or major"
        exit 1
        ;;
esac

echo -e "${GREEN}New version: $NEW_VERSION${NC}"

# Update package.json
echo "Updating package.json..."
node -e "
const fs = require('fs');
const pkg = require('./package.json');
pkg.version = '$NEW_VERSION';
fs.writeFileSync('./package.json', JSON.stringify(pkg, null, 2) + '\n');
"

# Update src-tauri/Cargo.toml
echo "Updating src-tauri/Cargo.toml..."
sed -i.bak "s/^version = \".*\"/version = \"$NEW_VERSION\"/" src-tauri/Cargo.toml
rm -f src-tauri/Cargo.toml.bak

# Update src-tauri/tauri.conf.json
echo "Updating src-tauri/tauri.conf.json..."
node -e "
const fs = require('fs');
const conf = require('./src-tauri/tauri.conf.json');
conf.version = '$NEW_VERSION';
fs.writeFileSync('./src-tauri/tauri.conf.json', JSON.stringify(conf, null, 2) + '\n');
"

echo -e "${GREEN}Version bumped to $NEW_VERSION in all files${NC}"

# Stage the version files
git add package.json src-tauri/Cargo.toml src-tauri/tauri.conf.json

echo -e "${GREEN}Files staged for commit${NC}"
