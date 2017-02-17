#!/usr/bin/env node
'use strict'

//Necessary libs
const express = require('express')
const parser  = require('body-parser')
const app     = express()
const msg     = require('gulp-messenger')
const chalk   = require('chalk')
const fs      = require('fs')
const _       = require('lodash')
const cmd     = require('commander')
const async   = require('async')
const path    = require('path')

//In-memory database
var db        = {}
//Object list
var objects   = []
//List of functions that read files
var fileReadFunctions = []

//Arguments parser
cmd
  .option('-d, --directory <dir>', '[optional] Path to directory that contains json files, default "db"', 'db')
  .option('-p, --port <port>', '[optional] Server port, default 3000', (n, d) => +n || d, 3000)
  .option('-i, --interval <interval>', '[optional] Save to files interval in seconds, default 30', (n, d) => +n || d, 30)
  .parse(process.argv)

//Seconds to milliseconds
cmd.interval *= 1000;

//Express config
app.set('port', (cmd.port || 3000))
app.use(parser.urlencoded({
  extended: false
}))
app.use(parser.json())

//Create API routes
function createPaths(values, key) {

  //Get all
  app.get('/' + key, (req, res) => {

    return res.json(values)
  })

  //Get element count
  app.get('/' + key + '/count', (req, res) => {

    return res.json({
      count: values.length
    })
  })

  //Get element with given id
  app.get('/' + key + '/:id', (req, res) => {

    let requestId = parseInt(req.params.id)
    let obj = _.find(values, {
      id: requestId
    })

    if (!obj) {
      return res.status(404).json({
        error: 'Could not find ' + key + ' with id: ' + requestId
      })
    }

    return res.json(obj)
  })

  //Add new element
  app.post('/' + key, (req, res) => {

    let obj = _.clone(req.body)
    let last = _.last(_.sortBy(values, 'id'))

    obj.id = last.id + 1
    
    values.push(obj)

    return res.json(obj)
  })

  //Update element
  app.put('/' + key + '/:id', (req, res) => {

    let requestId = parseInt(req.params.id)
    let obj = _.find(values, {
      id: requestId
    })
    
    if (!obj) {
      return res.status(404).json({
        error: 'Could not find ' + key + ' with id: ' + requestId
      })
    }

    obj = _.merge(obj, req.body)

    return res.json(obj)
  })

  //Delete element
  app.delete('/' + key + '/:id', (req, res) => {

    let requestId = parseInt(req.params.id)
    let obj = _.clone(_.find(values, {
      id: requestId
    }))
    
    if (!obj) {
      return res.status(404).json({
        error: 'Could not find ' + key + ' with id: ' + requestId
      })
    }

    _.remove(values, {
      id: requestId
    })

    return res.json(obj)
  })
}

//Save data to file
function writeToFile(values, key) {

  return fs.writeFile(path.join(cmd.directory + '/' + key + '.json'), JSON.stringify(values), (err) => {

    if (err) {
      msg.error('File write error, exiting...')
      msg.error(err)
      process.exit(1)
    }
  })
}

//Read file
function readFile(file) {

  var fname = file.split('.') 
  var fext = fname.pop()

  if (fext === 'json') {

    var f = cb => {

      return fs.readFile(path.join(cmd.directory + '/' + file), 'utf8', (err, data) => {
          
        if (err) {
          return cb(err)
        }

        if (!data) {
          msg.error('File: ' + file + ' is empty!');
          return cb(null)
        }

        db[fname.join('.')] = JSON.parse(data)
        objects.push(fname.join('.'))

        return cb(null)
      });
    }

    fileReadFunctions.push(f) 
  }
}

//All files have been read
function dbCached(err) {

  if (err) {
    msg.error('File read error')
    msg.error(err)
  }

  _.forOwn(db, (values, key) => {
    
    createPaths(values, key)
    setInterval(() => {
      writeToFile(values, key)
    }, cmd.interval)
  })
}

//Read directory
function readDirectory() {

  return fs.readdir(cmd.directory, (err, files) => {
     
    if (err) {
      msg.error('Directory read error, exiting...')
      msg.error(err)
      process.exit(-1)
    } 

    if (!files) {
      msg.error('Empty database directory, exiting...')
      process.exit(-1)
    } 

    files.forEach(readFile)

    async.parallel(fileReadFunctions, dbCached)
  })
}

app.get('/', (req, res) => {
  return res.json({
    availableRoutes: objects
  })
})

app.listen(app.get('port'), () => {

  const serverInfo = chalk.yellow('http://localhost:' + app.get('port'))

  msg.log('\n')
  msg.log(chalk.cyan('Reading directory: "' + cmd.directory + '"'))
  msg.log(chalk.cyan('File save interval: ' + (cmd.interval / 1000) + ' ms'))
  msg.log(chalk.cyan('Mock API Running On: "' + serverInfo + '"'))
  msg.log('\n')

  readDirectory()

  msg.log(chalk.green('Mock API Started ' + new Date()))
  msg.log('\n')
})
