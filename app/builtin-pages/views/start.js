/*
This uses the beaker.bookmarks API, which is exposed by webview-preload to all
sites loaded over the beaker: protocol
*/

import * as yo from 'yo-yo'
import {niceDate} from '../../lib/time'
import ColorThief from '../../lib/fg/color-thief'

const colorThief = new ColorThief()

const LATEST_VERSION = 6001 // semver where major*1mm and minor*1k; thus 3.2.1 = 3002001

// globals
// =

var showReleaseNotes = false
var isManagingBookmarks = false
var userProfile
var bookmarks, pinnedBookmarks, archivesList

setup()
async function setup () {
  await loadBookmarks()
  userProfile = await beaker.profiles.get(0)
  archivesList = (await beaker.archives.list({isSaved: true})) || []
  archivesList.sort((a, b) => {
    if (a.url === userProfile.url) {
      return -1
    }
    if (b.url === userProfile.url) {
      return 1
    }
    return a.title.localeCompare(b.title)
  })
  update()

  let latestVersion = await beakerSitedata.get('beaker://start', 'latest-version')
  if (+latestVersion < LATEST_VERSION) {
    showReleaseNotes = true
    update()
    beakerSitedata.set('beaker://start', 'latest-version', LATEST_VERSION)
  }
}

// rendering
// =

function update () {
  yo.update(document.querySelector('main'), yo`
    <main>
      <header>
        <div class="actions">
          <a href="#"><i class="fa fa-share-alt"></i> Share files</a>
          <a href="#"><i class="fa fa-sticky-note-o"></i> Share a note</a>
        </div>
        <div style="flex: 1"></div>
        ${renderProfileCard()}
      </header>
      ${renderPinnedBookmarks()}
      ${renderReleaseNotes()}
      ${renderArchivesList()}
    </main>
  `)
}

function renderProfileCard () {
  return yo`
    <div class="profile-card">
      <a href="#">Paul Frazee</a>
      <img class="avatar" src="https://pbs.twimg.com/profile_images/822287293910134784/8Ho9TSEQ_400x400.jpg" />
    </div>
  `
}

function renderArchivesList () {
  return yo`
    <div class="archives-container">
      <div class="archives-title">
        <h2>Your archives</h2>
        <a class="action" onclick=${onNewArchive}>
          <i class="fa fa-plus"></i>
          New archive
        </a>
      </div>
      <ul class="links-list archives-list">
        ${archivesList.map(renderArchive)}
      </ul>
    </div>
  `
}

function renderArchive (archive) {
  var {url, title, key} = archive
  var isProfile = (url === userProfile.url)
  var icon = isProfile ? 'user-circle-o' : 'folder-o'

  return yo`
    <li class="ll-row archive">
      <a class="link" href=${url} title=${title}>
        <i class="favicon fa fa-${icon}"></i>
        <span class="title">${title}${isProfile ? yo`<span class="label">Profile Site</a>` : ''}</span>
        <span class="url">${url}</span>
      </a>
      <div class="actions">
        <a href="beaker://editor/${key}">
          <i class="fa fa-pencil"></i>
        </a>
      </div>
    </li>
  `
}

function renderPinnedBookmarks () {
  var icon = isManagingBookmarks ? 'caret-down' : 'wrench'

  return yo`
    <div class="bookmarks-container">
      <p class="add-pin-toggle" onclick=${toggleAddPin}>
        <i class="fa fa-${icon}"></i>
        ${isManagingBookmarks ? 'Close' : 'Manage bookmarks'}
      </p>
      <div class="pinned-bookmarks">
        ${pinnedBookmarks.map(renderPinnedBookmark)}
      </div>
      ${renderBookmarks()}
    </div>
  `
}

function renderBookmarks () {
  if (!isManagingBookmarks) {
    return ''
  }

  const isNotPinned = row => !row.pinned

  const renderRow = row =>
    yo`
      <li class="bookmark ll-row">
        <a class="btn bookmark__pin" onclick=${e => pinBookmark(e, row)}>
          <i class="fa fa-thumb-tack"></i> Pin
        </a>
        <a href=${row.url} class="link bookmark__link" title=${row.title} />
          <img class="favicon bookmark__favicon" src=${'beaker-favicon:' + row.url} />
          <span class="title bookmark__title">${row.title}</span>
          <span class="url">${row.url}</span>
        </a>
      </li>`

  return yo`
    <div class="bookmarks">
      ${bookmarks.filter(isNotPinned).map(renderRow)}
    </div>
  `
}

function renderPinnedBookmark (bookmark) {
  var { url, title } = bookmark
  var [r, g, b] = bookmark.dominantColor || [255, 255, 255]
  return yo`
    <a class="pinned-bookmark ${isManagingBookmarks ? 'nolink' : ''}" href=${isManagingBookmarks ? '' : url}>
      <div class="favicon-container" style="background: rgb(${r}, ${g}, ${b})">
        ${isManagingBookmarks ? yo`<a class="unpin" onclick=${e => unpinBookmark(e, bookmark)}><i class="fa fa-times"></i></a>` : ''}
        <img src=${'beaker-favicon:' + url} class="favicon"/>
      </div>
      <div class="title">${title}</div>
    </a>
  `
}

function renderReleaseNotes () {
  if (!showReleaseNotes) {
    return ''
  }
  return yo`
    <div class="alert alert__info alert__release-notes">
      <strong>Welcome to Beaker 0.6.1!</strong>
      New start page, Dat-DNS, and an improved bkr command-line.
      <a href="https://github.com/beakerbrowser/beaker/releases/tag/0.6.1">Learn more</a>
    </div>
  `
}

// event handlers
// =

async function onNewArchive (e) {
  e.preventDefault()
  e.stopPropagation()

  var archive = await beaker.archives.create()
  window.location = 'beaker://editor/' + archive.url.slice('dat://'.length)
}

function toggleAddPin (url, title) {
  isManagingBookmarks = !isManagingBookmarks
  update()
}

async function pinBookmark (e, {url}) {
  e.preventDefault()
  e.stopPropagation()

  await beaker.bookmarks.togglePinned(url, true)
  await loadBookmarks()
  update()
}

async function unpinBookmark (e, {url}) {
  e.preventDefault()
  e.stopPropagation()

  await beaker.bookmarks.togglePinned(url, false)
  await loadBookmarks()
  update()
}

// helpers
// =

async function loadBookmarks () {
  bookmarks = (await beaker.bookmarks.list()) || []
  pinnedBookmarks = (await beaker.bookmarks.list({pinned: true})) || []
  
  // load dominant colors of each pinned bookmark
  await Promise.all(pinnedBookmarks.map(attachDominantColor))
}

function attachDominantColor (bookmark) {
  return new Promise(resolve => {
    var img = new Image()
    img.setAttribute('crossOrigin', 'anonymous')
    img.onload = e => {
      var c = colorThief.getColor(img, 10)
      c[0] = (c[0] / 4)|0 + 192
      c[1] = (c[1] / 4)|0 + 192
      c[2] = (c[2] / 4)|0 + 192
      bookmark.dominantColor = c
      resolve()
    }
    img.onerror = resolve
    img.src = 'beaker-favicon:' + bookmark.url
  })
}
