var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});

/* GET API hello */
router.get('/api/hello', function(req, res) {
  res.json({ message: 'Hello from Node' });
});

module.exports = router;
