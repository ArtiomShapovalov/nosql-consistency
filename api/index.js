const express = require('express');
const bodyParser = require('body-parser');
const mongodb = require('mongodb');
const bluebird = require('bluebird');
const cassandra = require('cassandra-driver');
const cassandaraSystemClient = new cassandra.Client({
  contactPoints: ['127.0.0.1'],
  keyspace: 'system'
});

let cassandaraClient

new Promise((resolve, reject) => {
  resolve(cassandaraSystemClient.execute("CREATE KEYSPACE IF NOT EXISTS demo WITH REPLICATION = {'class' : 'SimpleStrategy', 'replication_factor' : 3}"))
})
.then(() => {
  cassandaraClient = new cassandra.Client({
    contactPoints: ['127.0.0.1'],
    keyspace: 'demo'
  })
})
.catch((err) => {
  console.log('[ERROR] - Cassandra table create:');
  console.log(err);
})

const redis = require('redis');
bluebird.promisifyAll(redis.RedisClient.prototype);
bluebird.promisifyAll(redis.Multi.prototype);
const redisClient = redis.createClient(6379, 'localhost');

const app = express();

app.use(bodyParser.json({ type: 'application/json' }))

app.get('/', (req, res) => {
  var MongoClient = mongodb.MongoClient;
  var url = 'mongodb://localhost:27017/todo';

  MongoClient.connect(url, function (err, db) {
    if (err) {
      console.log('Unable to connect to the Server', err);
    } else {
      console.log('Connection established to', url);
      var collection = db.collection('todos');

      collection.find({}).toArray(function (err, result) {
        if (err) {
          res.send(err);
        } else if (result.length) {
          console.log(result)
          res.send(result);
        } else {
          res.send('No documents found');
        }
        db.close();
      });
    }
  });
})

app.post('/', (req, res) => {
  const body = req.body;
  console.log(body)

  var MongoClient = mongodb.MongoClient;
  var url = 'mongodb://localhost:27017/todo';

  MongoClient.connect(url, function (err, db) {
    if (err) {
      console.log('Unable to connect to the Server', err);
    } else {
      console.log('Connection established to', url);
      var collection = db.collection('todos');

      collection.insert(body, function (err, result) {
        console.log('res:')
        console.log(result)
        res.set('Content-Type', 'application/json');
        res.send(result);
      });
    }
  });
})

// TESTS

const SUCCESS = 1
const FAIL = 2
const SERVER_ERROR = 3

const figureOutScore = (values, callback) => {
  let totalScore = 0
  const valuesWithScores = values.map(v => {
    if (v.status === SUCCESS && v.isImportant) {
      v.score = 3
      totalScore += 3
    } else if (v.status === SUCCESS && !v.isImportant) {
      v.score = 2
      totalScore += 2
    } else {
      v.score = 0
    }
    return v
  })

  totalScore = totalScore * 12 / 10
  let result = {}
  switch (true) {
    case totalScore <= 3:
      const veryBad = 1 - totalScore / 3
      const bad = totalScore / 3
      if (veryBad > bad) {
        result = { number: 1, text: 'Согласованность: очень низкая' }
      } else {
        result = { number: 2, text: 'Согласованность: низкая' }
      }
      break;
    case totalScore > 3 && totalScore <= 6:
      const bad2 = 2 - totalScore / 3
      const average = totalScore / 3 - 1
      if (bad2 > average) {
        result = { number: 2, text: 'Согласованность: низкая' }
      } else {
        result = { number: 3, text: 'Согласованность: умеренная' }
      }
      break;
    case totalScore > 6 && totalScore <= 9:
      const average2 = 3 - totalScore / 3
      const good = totalScore / 3 - 2
      if (average2 > good) {
        result = { number: 3, text: 'Согласованность: умеренная' }
      } else {
        result = { number: 4, text: 'Согласованность: высокая' }
      }
      break;
    case totalScore > 9 && totalScore <= 12:
      const good2 = 4 - totalScore / 3
      const veryGood = totalScore / 3 - 3
      if (good2 > veryGood) {
        result = { number: 4, text: 'Согласованность: высокая' }
      } else {
        result = { number: 5, text: 'Согласованность: очень высокая' }
      }
      break;
    default:
      break;
  }

  return callback(result, valuesWithScores)
}

app.post('/test/cassandra', (req, res) => {
  const body = req.body;
  console.log('---------------------------')
  console.log('Cassandra tests')
  console.log(body)

  const value1 = 'task1'
  const value2 = 'task2'
  const value3 = 'task3'
  const value4 = 'task4'
  const value5 = 'task5'

  redisClient.del('email1')
  redisClient.del('email2')
  redisClient.del('email3')

  new Promise((resolve, reject) => {
    resolve(cassandaraClient.execute('CREATE TABLE data_test(email text PRIMARY KEY, info text)'))
  })
  .then(() => {
    Promise.all([
      // test 1 - doesn't provide uniqueness
      new Promise((resolve, reject) => {
        resolve({ testId: 1, status: FAIL })
      })
      .catch((err) => {
        console.log('test1 - res:');
        console.log('Success');
        return { testId: 1, status: FAIL }
      }),

      // test 2
      Promise.all([
        cassandaraClient.execute(`INSERT INTO data_test (email, info) VALUES ('email1', '${value1}')`),
        cassandaraClient.execute("SELECT info FROM data_test WHERE email='email1'"),
      ])
      .then((result) => {
        console.log('test2 - res:');
        console.log(result);
        if (result[1] && result[1].rows[0] && result[1].rows[0].info === value1) {
          return { testId: 2, status: SUCCESS, isImportant: false }
        } else {
          return { testId: 2, status: FAIL }
        }
      })
      .catch((err) => {
        console.log('test2 - err:')
        console.log(err)
        return { testId: 2, status: SERVER_ERROR }
      }),

      // test 3
      Promise.all([
        cassandaraClient.execute(`INSERT INTO data_test (email, info) VALUES ('email2', '${value2}')`),
        cassandaraClient.execute(`UPDATE data_test SET info='${value3}' WHERE email='email2'`),
        cassandaraClient.execute(`UPDATE data_test SET info='${value4}' WHERE email='email2'`),
      ])
      .then(() => cassandaraClient.execute("SELECT info FROM data_test WHERE email='email2'"))
      .then((result) => {
        console.log('test3 - res:');
        console.log(result);
        if (result.rows[0] && result.rows[0].info === value4) {
          return { testId: 3, status: SUCCESS, isImportant: false }
        } else {
          return { testId: 3, status: FAIL }
        }
      })
      .catch((err) => {
        console.log('test3 - err:')
        console.log(err)
        return { testId: 3, status: SERVER_ERROR }
      }),

      // test 4 - doesn't support ACID transaction
      new Promise((resolve, reject) => {
        resolve({ testId: 4, status: FAIL })
      })
      .catch((err) => {
        console.log('test1 - res:');
        console.log('Success');
        return { testId: 4, status: FAIL }
      }),
    ])
    .then((values) => {
      console.log('-------------------------')
      console.log('RESULTS:')
      console.log(values)

      new Promise((resolve, reject) => {
        resolve(cassandaraClient.execute('DROP TABLE IF EXISTS data_test'))
      })
      .then(() => {
        figureOutScore(values, (result, valuesWithScores) => {
          console.log(result)
          res.set('Content-Type', 'application/json');
          res.send({ result, values: valuesWithScores });
        })
      })
      .catch((err) => {
        res.set('Content-Type', 'application/json');
        res.send({ status: 3 })
      })
    })
    .catch((err) => {
      res.set('Content-Type', 'application/json');
      res.send({ status: 3 })
    })
  })
  .catch((err) => {
    console.log('[ERROR] - Cassandra table create:');
    console.log(err);
  })
})

app.post('/test/redis', (req, res) => {
  const body = req.body;
  console.log('---------------------------')
  console.log('Redis tests')
  console.log(body)

  const value1 = 'task1'
  const value2 = 'task2'
  const value3 = 'task3'
  const value4 = 'task4'
  const value5 = 'task5'

  redisClient.del('email1')
  redisClient.del('email2')
  redisClient.del('email3')

  Promise.all([
    // test 1 - doesn't support uniqueness
    new Promise((resolve, reject) => {
      resolve({ testId: 1, status: FAIL })
    })
    .catch((err) => {
      console.log('test1 - res:');
      console.log('Success');
      return { testId: 1, status: FAIL }
    }),

    // test 2
    Promise.all([
      redisClient.setAsync("email", value1),
      redisClient.getAsync("email"),
    ])
    .then((result) => {
      console.log('test2 - res:');
      console.log(result);
      if (result[1] && result[1] === value1) {
        return { testId: 2, status: SUCCESS, isImportant: false }
      } else {
        return { testId: 2, status: FAIL }
      }
    })
    .catch((err) => {
      console.log('test2 - err:')
      console.log(err)
      return { testId: 2, status: SERVER_ERROR }
    }),

    // test 3
    Promise.all([
      redisClient.setAsync('email2', value2),
      redisClient.setAsync('email2', value3),
      redisClient.setAsync('email2', value4),
    ])
    .then(() => redisClient.getAsync('email2'))
    .then((result) => {
      console.log('test3 - res:');
      console.log(result);
      if (result === value4) {
        return { testId: 3, status: SUCCESS, isImportant: false }
      } else {
        return { testId: 3, status: FAIL }
      }
    })
    .catch((err) => {
      console.log('test3 - err:')
      console.log(err)
      return { testId: 3, status: SERVER_ERROR }
    }),

    // test 4
    redisClient.multi()
      .set('email3', value5)
      .get('email3')
      .execAsync()
      .then((result) => {
        console.log('test4 - res:');
        console.log(result);
        if (result[1] && result[1] === value5) {
          return { testId: 4, status: SUCCESS, isImportant: true }
        } else {
          return { testId: 4, status: FAIL }
        }
      })
      .catch((err) => {
        console.log('test4 - err:')
        console.log(err)
        return { testId: 4, status: SERVER_ERROR }
      })
  ])
  .then((values) => {
    console.log('-------------------------')
    console.log('RESULTS:')
    console.log(values)

    figureOutScore(values, (result, valuesWithScores) => {
      console.log(result)
      res.set('Content-Type', 'application/json');
      res.send({ result, values: valuesWithScores });
    })
  })
  .catch((err) => {
    res.set('Content-Type', 'application/json');
    res.send({ status: 3 })
  })
})

app.post('/test/mongo', (req, res) => {
  const body = req.body;
  console.log(body)
  var MongoClient = mongodb.MongoClient;
  var url = 'mongodb://localhost:27017/todo';

  const value = 'task1'
  const value2 = 'task2'
  const value3 = 'task3'
  const time = 5000
  Promise.all([
    // test 1
    MongoClient.connect(url)
      .then((db, err) => {
        if (err) {
          console.log('test1 - Unable to connect to the Server', err);
          return { err: 'Database error' }
        } else {
          console.log('test1 - Connection established to', url);
          const collection = db.collection('test');
          collection.createIndex( { 'email': 1 }, { unique: true } );
          return collection.insert([{ email: value, text: '1' }, { email: value, text: '2' }]);
        }
      })
      .then((result) => {
        console.log('test1 - res:');
        console.log(result);
        return { testId: 1, status: FAIL }
      })
      .catch((err) => {
        console.log('test1 - res:');
        console.log('Success');
        return { testId: 1, status: SUCCESS, isImportant: true }
      }
    ),

    // test 2
    MongoClient.connect(url)
      .then((db, err) => {
        if (err) {
          console.log('test2 - Unable to connect to the Server', err);
          return { err: 'Database error' }
        } else {
          console.log('test2 - Connection established to', url);
          const collection = db.collection('test');
          return Promise.all([
            collection.insert({ email: value2, text: '3' }),
            collection.findOne({ email: value2 })
          ])
        }
      })
      .then((result) => {
        console.log('test2 - res:');
        console.log(result);
        if (result[1] && result[1].email === value2) {
          return { testId: 2, status: SUCCESS, isImportant: false }
        } else {
          return { testId: 2, status: FAIL }
        }
      })
      .catch((err) => {
        console.log('test2 - err:')
        console.log(err)
        return { testId: 2, status: SERVER_ERROR }
      }
    ),

    // test 3
    MongoClient.connect(url)
      .then((db, err) => {
        if (err) {
          console.log('test3 - Unable to connect to the Server', err);
          return { err: 'Database error' }
        } else {
          console.log('test3 - Connection established to', url);
          const collection = db.collection('test');
          return [
            collection,
            Promise.all([
              collection.insert({ email: value3, text: '3' }),
              collection.update({ email: value3 }, { email: value3, text: '4'}, { upsert: true }),
              collection.update({ email: value3 }, { email: value3, text: '5'}, { upsert: true }),
            ])
          ]
        }
      })
      .then(values => values[0].findOne({ email: value3 }))
      .then((result) => {
        console.log('test3 - res:');
        console.log(result);
        if (result[0] && result[0].text === '5') {
          return { testId: 3, status: SUCCESS, isImportant: false }
        } else {
          return { testId: 3, status: FAIL }
        }
      })
      .catch((err) => {
        console.log('test3 - err:')
        console.log(err)
        return { testId: 3, status: SERVER_ERROR }
      }
    ),

    // test 4
    MongoClient.connect(url)
      .then((db, err) => {
        if (err) {
          console.log('test4 - Unable to connect to the Server', err);
          return { err: 'Database error' }
        } else {
          console.log('test4 - Connection established to', url);
          const accounts = db.collection('accounts');
          const transactions = db.collection('transactions');

          return accounts.insert([
            { _id: 'A', balance: 1000, pendingTransactions: [] },
            { _id: 'B', balance: 1000, pendingTransactions: [] }
          ])
          .then(() => transactions.insert(
            { _id: 1, source: 'A', destination: 'B', value: 100, state: 'initial', lastModified: new Date() }
          ))
          .then(() => transactions.findOne( { state: 'initial' }))
          .then(t => [t, transactions.update(
            { _id: t._id, state: 'initial' },
            {
              $set: { state: 'pending' },
              $currentDate: { lastModified: true }
            }
          )])
          .then(values => [values[0], accounts.update(
            { _id: values[0].source, pendingTransactions: { $ne: values[0]._id } },
            { $inc: { balance: -values[0].value }, $push: { pendingTransactions: values[0]._id } }
          )])
          .then(values => [values[0], accounts.update(
            { _id: values[0].destination, pendingTransactions: { $ne: values[0]._id } },
            { $inc: { balance: values[0].value }, $push: { pendingTransactions: values[0]._id } }
          )])
          .then(values => [values[0], transactions.update(
            { _id: values[0]._id, state: 'pending' },
            {
              $set: { state: 'applied' },
              $currentDate: { lastModified: true }
            }
          )])
          .then(values => [values[0], accounts.update(
            { _id: values[0].source, pendingTransactions: values[0]._id },
            { $pull: { pendingTransactions: values[0]._id } }
          )])
          .then(values => [values[0], accounts.update(
            { _id: values[0].destination, pendingTransactions: values[0]._id },
            { $pull: { pendingTransactions: values[0]._id } }
          )])
          .then(values => transactions.update(
            { _id: values[0]._id, state: 'applied' },
            {
              $set: { state: 'done' },
              $currentDate: { lastModified: true }
            }
          ))
          .then(() => [accounts.findOne({ _id: 'A' }), accounts.findOne({ _id: 'B' })])
        }
      })
      .then((results) => Promise.all(results))
      .then((results) => {
        console.log('test4 - res:');
        console.log(results);
        if (results[0] && results[0].balance === 900 && results[1] && results[1].balance === 1100) {
          return { testId: 4, status: SUCCESS, isImportant: true }
        } else {
          return { testId: 4, status: FAIL }
        }
      })
      .catch((err) => {
        console.log('test4 - err:')
        console.log(err)
        return { testId: 4, status: SERVER_ERROR }
      }),
  ])
  .then((values) => {
    console.log('-------------------------')
    console.log('RESULTS:')
    console.log(values)
    MongoClient.connect(url)
      .then((db, err) => {
        if (err) {
          console.log('results - Unable to connect to the Server', err);
          res.set('Content-Type', 'application/json');
          res.send({ status: 3 });
        } else {
          console.log('results - Connection established to', url);
          db.collection('test').drop();
          db.collection('accounts').drop();
          db.collection('transactions').drop();

          figureOutScore(values, (result, valuesWithScores) => {
            res.set('Content-Type', 'application/json');
            res.send({ result, values: valuesWithScores });
          })
        }
      })
      .catch((err) => {
        res.set('Content-Type', 'application/json');
        res.send({ status: 3 })
      })
  })
})

app.listen(3000, err => {
  if (err) {
    throw err;
  }

  var MongoClient = mongodb.MongoClient;
  var url = 'mongodb://localhost:27017/todo';

  MongoClient.connect(url)
    .then((db, err) => {
      if (err) {
        console.log('Unable to connect to the Server', err);
        return { err: 'Database error' }
      } else {
        console.log('Connection established to', url);
        const collection = db.collection('todos');
        collection.findOne()
          .then((value) => {
            console.log(value)
            if (!value) {
              collection.insert([
                { text: 'Одновременная запись в одну таблицу одного и тогоже объекта с уникальным индексом' },
                { text: 'Одновременная запись и чтение объекта из двух разных потоков' },
                { text: 'Одновременная запись из двух потоков' },
                { text: 'Прерывание и откат транзакции между двумя объектами' },
              ]);
            }
          })
      }
    })
    .catch((err) => {
      console.log('Error: Initial db data insert');
      console.log(err);
    }
  ),

  console.log('Server started on port 3000');
})
