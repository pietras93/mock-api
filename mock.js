#!/usr/bin/env node
'use strict'

// Necessary libs
const express = require('express')
const parser  = require('body-parser')
const msg     = require('gulp-messenger')
const chalk   = require('chalk')
const fs      = require('fs')
const _       = require('lodash')
const cmd     = require('commander')
const async   = require('async')
const path    = require('path')

class MockApi {

  constructor(options) {
    // In-memory database
    this.db = {}
    // Routes list
    this.routes = []
    // List of functions that read files
    this.fileReadFunctions = []
    // File write flag
    this.busy = false
    // Express object
    this.app = express()
    // Options
    this.options = {
      directory: 'db',
      port: 3000,
      interval: 30
    }
    
    Object.assign(this.options, options)

    this.options.interval *= 1000

    this.createPaths = this.createPaths.bind(this)
    this.writeToFiles = this.writeToFiles.bind(this)
    this.filesRead = this.filesRead.bind(this)
    this.readFile = this.readFile.bind(this)
  }

  /**
   * Creates express API paths for models
   * @param {object} values - JSON with model contents
   * @param {string} key - model/path name
   */
  createPaths(values, key) {
  
    // Get all
    this.app.get('/' + key, (req, res) => {
  
      return res.json(values)
    })
  
    // Get element count
    this.app.get('/' + key + '/count', (req, res) => {
  
      return res.json({
        count: values.length
      })
    })
  
    // Get element with given id
    this.app.get('/' + key + '/:id', (req, res) => {
  
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
  
    // Add new element
    this.app.post('/' + key, (req, res) => {
  
      let obj = _.clone(req.body)
      let last = _.last(_.sortBy(values, 'id'))
  
      obj.id = last.id + 1
      
      values.push(obj)
  
      return res.json(obj)
    })
  
    // Update element
    this.app.put('/' + key + '/:id', (req, res) => {
  
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
  
    // Delete element
    this.app.delete('/' + key + '/:id', (req, res) => {
  
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
  
  /**
   * Saves in-memory data to corresponding files
   * @param {object} values - JSON with model contents
   * @param {string} key - model and file name
   */
  writeToFiles(values, key) {
  
    this.busy = true
  
    return fs.writeFile(path.join(this.options.directory + '/' + key + '.json'), JSON.stringify(values), (err) => {
  
      if (err) {
        msg.error('File write error, exiting...')
        msg.error(err)
        process.exit(1)
      }
  
      this.busy = false
    })
  }

  /**
   * To be called after data is read from files.
   * Calls createPaths for each object and creates file update interval
   * @param {*} err - if exists will be printed in console
   */
  filesRead(err) {
  
    if (err) {
      msg.error('File read error')
      msg.error(err)
    }
  
    _.forOwn(this.db, (values, key) => {
      
      // Create express routes once
      this.createPaths(values, key)
      this.busy = false

      // Write memory db to files every INTERVAL
      setInterval(() => {
        this.writeToFiles(values, key)
      }, this.options.interval)
    })
  }

  /**
   * readFile - fills fileReadFuctions array with function
   * reading file.json from db directory
   * @param {string} file - filename w/o extension
   */
  readFile(file) {
    
    let fname = file.split('.') 
    let fext = fname.pop()
  
    if (fext === 'json') {
  
      let f = (cb) => {
  
        return fs.readFile(path.join(this.options.directory + '/' + file), 'utf8', (err, data) => {
            
          if (err) {
            return cb(err)
          }
  
          if (!data) {
            msg.error('File: ' + file + ' is empty!');
            return cb(null)
          }
  
          this.db[fname.join('.')] = JSON.parse(data)
          this.routes.push(fname.join('.'))
  
          return cb(null)
        })
      }

      // Create array of file readding functions
      this.fileReadFunctions.push(f) 
    }
  }

  /**
   * Reads files in db directory and executes fileReadFunctions
   * Exits on dir read error and empty db directory
   */
  init() {
    
    this.busy = true

    return fs.readdir(this.options.directory, (err, files) => {
        
      if (err) {
        msg.error('Directory read error, exiting...')
        msg.error(err)
        process.exit(-1)
      } 

      if (!files) {
        msg.error('Empty database directory, exiting...')
        process.exit(-1)
      } 

      files.forEach(this.readFile)

      async.parallel(this.fileReadFunctions, this.filesRead)
    })
  }

  start() {
    
    // Express config
    this.app.set('port', this.options.port)
    this.app.use(parser.urlencoded({
      extended: false
    }))
    this.app.use(parser.json())

    // Break if busy
    this.app.use((req, res, next) => {
    
      if (this.busy) {
        return res.status(400).send({ message: 'Server is busy at the moment, please try again in a moment' })
      }
    
      return next()
    })
    
    // List available paths
    this.app.get('/', (req, res) => {
      
      return res.json({
        availableRoutes: this.routes
      })
    })

    // Start listening
    this.app.listen(this.app.get('port'), () => {
      
        const serverInfo = chalk.yellow('http://localhost:' + this.app.get('port'))
      
        msg.log('\n')
        msg.log(chalk.cyan('Reading directory: "' + this.options.directory + '"'))
        msg.log(chalk.cyan('File save interval: ' + (this.options.interval / 1000) + ' s'))
        msg.log(chalk.cyan('Mock API Running On: "' + serverInfo + '"'))
        msg.log('\n')
      
        this.init()
      
        msg.log(chalk.green('Mock API Started ' + new Date()))
        msg.log('\n')
      })
  }
}

module.exports = MockApi

// Arguments parser
cmd
.option('-d, --directory <dir>', '[optional] Path to directory that contains json files, default "db"', 'db')
.option('-p, --port <port>', '[optional] Server port, default 3000', (n, d) => +n || d, 3000)
.option('-i, --interval <interval>', '[optional] Save to files interval in seconds, default 30', (n, d) => +n || d, 30)
.parse(process.argv)

let mock = new MockApi(cmd)
mock.start()