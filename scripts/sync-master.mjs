#!/usr/bin/env node

import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const args = process.argv.slice(2)
const noTag = args.includes('--no-tag')
const minor = args.includes('--minor')
const patch = args.includes('--patch')

const exec = (command, options = {}) => {
  try {
    return execSync(command, { encoding: 'utf8', stdio: 'inherit', ...options })
  } catch (error) {
    console.error(`Error executing: ${command}`)
    process.exit(1)
  }
}

const execSilent = (command) => {
  try {
    return execSync(command, { encoding: 'utf8', stdio: 'pipe' }).trim()
  } catch (_error) {
    return ''
  }
}

const bumpVersion = (version, type) => {
  const parts = version.split('.').map(Number)
  if (type === 'minor') {
    parts[1]++
    parts[2] = 0
  } else {
    parts[2]++
  }
  return parts.join('.')
}

const updatePackageVersion = (newVersion) => {
  const pkg = JSON.parse(readFileSync('./package.json', 'utf8'))
  pkg.version = newVersion
  writeFileSync('./package.json', JSON.stringify(pkg, null, 2) + '\n')
}

if (noTag) {
  console.log('Syncing develop to master (without tagging)...\n')
} else if (minor) {
  console.log('Syncing develop to master (minor version bump)...\n')
} else if (patch) {
  console.log('Syncing develop to master (patch version bump)...\n')
} else {
  console.log('Syncing develop to master (minor version bump)...\n')
}

const currentBranch = execSilent('git rev-parse --abbrev-ref HEAD')
if (currentBranch !== 'develop') {
  console.error('Error: You must be on "develop" branch')
  console.error(`   Current branch: ${currentBranch}`)
  process.exit(1)
}

const hasChanges = execSilent('git diff-index --quiet HEAD -- || echo "changes"')
if (hasChanges === 'changes') {
  console.error('Error: You have uncommitted changes')
  console.error('   Please commit or stash them first')
  process.exit(1)
}

console.log('Pushing develop...')
exec('git push origin develop')

console.log('Switching to master...')
exec('git checkout master')

console.log('Pulling latest master...')
execSilent('git pull origin master')

console.log('Merging develop into master...')

try {
  execSync('git merge develop --no-edit', {
    encoding: 'utf8',
    stdio: 'pipe',
    env: { ...process.env, SKIP_VERSION_BUMP: '1' },
  })
  console.log('Merge completed successfully')
} catch (_error) {
  const conflictedFiles = execSilent('git diff --name-only --diff-filter=U')

  if (conflictedFiles) {
    console.log('Merge conflicts detected, resolving automatically...')

    if (conflictedFiles.includes('package.json')) {
      console.log("   Resolving package.json: using develop's version")
      execSync('git checkout --theirs package.json', { stdio: 'pipe' })
      execSync('git add package.json', { stdio: 'pipe' })
    }

    const remainingConflicts = execSilent('git diff --name-only --diff-filter=U')

    if (remainingConflicts) {
      console.error(`Unresolved conflicts in: ${remainingConflicts}`)
      console.error('   Please resolve them manually')
      exec('git checkout develop')
      process.exit(1)
    }

    execSync('git commit --no-edit', {
      encoding: 'utf8',
      stdio: 'inherit',
      env: { ...process.env, SKIP_VERSION_BUMP: '1' },
    })
    console.log('Conflicts resolved and merge completed')
  } else {
    console.error('Error executing merge')
    exec('git checkout develop')
    process.exit(1)
  }
}

// Version bump (unless --no-tag)
let newVersion = ''
if (!noTag) {
  const pkg = JSON.parse(readFileSync('./package.json', 'utf8'))
  const currentVersion = pkg.version
  const bumpType = patch ? 'patch' : 'minor'
  newVersion = bumpVersion(currentVersion, bumpType)

  console.log(`Bumping version: ${currentVersion} -> ${newVersion}`)
  updatePackageVersion(newVersion)

  execSync('git add package.json', { stdio: 'pipe' })
  execSync(`git commit -m "chore: bump version to ${newVersion}"`, {
    stdio: 'inherit',
    env: { ...process.env, SKIP_VERSION_BUMP: '1' },
  })

  // Generate changelog
  const previousTag = execSilent('git describe --tags --abbrev=0 HEAD~1 2>/dev/null')
  let changelog = ''
  if (previousTag) {
    changelog = execSilent(`git log ${previousTag}..HEAD --pretty=format:"- %s (%h)" --no-merges`)
  } else {
    changelog = execSilent('git log --pretty=format:"- %s (%h)" --no-merges -20')
  }

  // Create tag using a temp file for the message (avoids shell escaping issues)
  const tagMessage = `Release version ${newVersion}\n\nChangelog:\n${changelog}`
  const tempFile = join(tmpdir(), `git-wayback-tag-${Date.now()}.txt`)
  writeFileSync(tempFile, tagMessage)
  
  try {
    execSync(`git tag -a "v${newVersion}" -F "${tempFile}"`, { stdio: 'pipe' })
    console.log(`Tag v${newVersion} created`)
  } finally {
    try { unlinkSync(tempFile) } catch {}
  }
}

console.log('Pushing master...')
exec('git push origin master')

if (!noTag && newVersion) {
  console.log(`Pushing tag v${newVersion}...`)
  exec(`git push origin v${newVersion}`)
}

// Sync version back to develop
console.log('Syncing version to develop...')
exec('git checkout develop')

if (!noTag && newVersion) {
  updatePackageVersion(newVersion)
  execSync('git add package.json', { stdio: 'pipe' })
  execSync(`git commit -m "chore: sync version to ${newVersion}"`, {
    stdio: 'inherit',
    env: { ...process.env, SKIP_VERSION_BUMP: '1' },
  })
  exec('git push origin develop')
}

console.log('\nSync completed!')
if (noTag) {
  console.log('No tag was created (--no-tag flag used)')
} else {
  console.log(`Version: ${newVersion}`)
  console.log(`Tag: v${newVersion}`)
}
console.log('')
