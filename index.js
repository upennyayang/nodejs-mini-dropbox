// Codepath Project 2: Dropbox Clone

let express = require('express')
let fs = require('fs')
let path = require('path')
let nodeify = require('bluebird-nodeify')
let morgan = require('morgan')
let mime = require('mime-types')
let mkdirp = require('mkdirp')
let rimraf = require('rimraf')

require('songbird')

const NODE_ENV = process.env.NODE_ENV
const PORT = process.env.PORT || 8000
const ROOT_DIR = process.cwd()

let app = express()

if(NODE_ENV === 'development') {
    app.use(morgan('dev'))
}

app.listen(PORT, () => {
    console.log(`Listening @ http://127.0.0.1${PORT}`)
})

app.get('*', setFileMeta, sendHeaders, (req, res) => {
    if(res.body) {
        res.json(res.body)
        return
    }

    fs.createReadStream(req.filePath).pipe(res)
})

app.head('*', setFileMeta, sendHeaders, (req, res) => res.end())

app.delete('*', setFileMeta, (req, res, next) => {
    async() => {
        if(!req.stat) return res.send(400, 'Invalid Path')

        if(req.stat.isDirectory()) {
            await rimraf.promise(req.filePath)

        } else {
            await fs.promise.unlink(req.filePath)
        }

        res.end()
    }().catch(next)
})

app.put('*', setFileMeta, setDirDetails, (req, res, next) => {
    async() => {
      if(req.stat) return res.send(405, 'File exists')
      await mkdirp.promise(req.dirPath)

      if(!req.isDir) req.pipe(fs.createWriteStream(req.filePath))
      res.end()
    }().catch(next)

})

app.post('*', setFileMeta, setDirDetails, (req, res, next) => {
    async() => {
      if(!req.stat) return res.send(405, 'File does not exists')
      if(req.isDir) return res.send(405, 'Path is a directory')

      await fs.promise.truncate(req.filePath, 0)
      req.pipe(fs.createWriteStream(req.filePath))
      res.end()
    }().catch(next)

})

function setDirDetails(req, res, next) {
    let filePath = req.filePath
    let endsWithSlash = filePath.charAt(filePath.length - 1) === path.sep
    let hasExtension = path.extname(filePath) !== ''
    req.isDir = endsWithSlash || !hasExtension
    req.dirPath = req.isDir ? filePath : path.dirname(req.filePath)
    next()
}

function setFileMeta(req, res, next) {
    req.filePath = path.resolve(path.join(ROOT_DIR, req.url))
    if(req.filePath.indexOf(ROOT_DIR) !== 0) {
        res.send(400, 'Invalid path')
        return
    }
    fs.promise.stat(req.filePath)
        .then(stat => req.stat = stat, () => req.stat = null)
        .nodeify(next)
}

function sendHeaders(req, res, next) {
    nodeify(async () => {

        // directory
        if(req.stat.isDirectory()) {
            let files = await fs.promise.readdir(req.filePath)
            res.body = JSON.stringify(files)
            res.setHeader('Content-Length', res.body.length)
            res.setHeader('Content-Type', 'application/json')
            return
        }

        //file
        res.setHeader('Content-Length', req.stat.size)
        let contentType = mime.contentType(path.extname(req.filePath))
        res.setHeader('Content-Type', contentType)
    }(), next)
}

// Test commands

// GET
// curl -v http://127.0.0.1:8000/index.js -X GET

// HEAD
//curl -v http://127.0.0.1:8000/index.js --head

// DELETE
//touch test.js
//curl -v http://127.0.0.1:8000/test.js -X DELETE
//cat test.js
// mkdir test
// curl -v http://127.0.0.1:8000/test -X DELETE
// cat test

// PUT
// curl -v http://127.0.0.1:8000/foo -X PUT
// curl -v http://127.0.0.1:8000/foo/bar.js -X PUT -d "Hello World"
// curl -v http://127.0.0.1:8000/foo -X DELETE

// POST
// curl -v http://127.0.0.1:8000/foo -X POST
// curl -v http://127.0.0.1:8000/foo/bar.js -X POST
// touch foo/bar.js
// curl -v http://127.0.0.1:8000/foo/bar.js -X POST -d "Hello World"
// touch foo/bar.js
// curl -v http://127.0.0.1:8000/foo/bar.js -X POST -d "asdf"