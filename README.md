# mock-api
Small node tool to create ad hoc API from JSON files. It was created in order to faciliate front-end work when there is no back-end ready. Just put your data in JSON files and start Mock API, *et voilà !*

## How to use

This creates an REST API service using JSON files that are inside given directory.

Inside given direcory (or "./db" default) place your JSON files with array of desired elements inside. File name (minus .json) will become API route.

**If file is empty, it won't be included in routes.**

Content of files is cached in memory and saved to files every **<interval>** seconds, defaults to 30.
Server is listenting on **<port>** port, defaults to 3000.

When **/** is requested with GET method, server will respond with list of available objects. For each object routes shown in table below are created.

| Route         | Method | Action                    | Response                    |
|---------------|--------|---------------------------|-----------------------------|
| /object       | GET    | List all objects          | All records of given object |
| /object/:id   | GET    | Get one object            | Object of given id          |
| /object/count | GET    | Count objects             | Count                       |
| /object       | POST   | Create new object         | Newly created object        |
| /object/:id   | PUT    | Update object of given id | Updated object              |
| /object/:id   | DELETE | Delete object of given id | Deleted object              |

Available params:
```
-h, --help help
-d, --directory <dir> [optional] Path to directory that contains json files, default "db"
-p, --port <port> [optional] Server port, default 3000
-i, --interval <interval> [optional] Save to files interval in seconds, default 30
```

## In order to run Mock API:
Install dependencies and start service 
```
$ npm install
$ ./mock.js
```
## In order to import as lib
Import class and create new object with params
```
// ES7
import MockAPI from './mock.js'
// ES6
const MockAPI = require('./mock.js')

const mock = new MockAPI(params)
```

### Used tech:

- Node
- Express
- Lodash
- Chalk
- Async
