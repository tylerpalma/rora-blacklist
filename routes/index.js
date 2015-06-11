var express = require('express');
var fs      = require('fs');
var request = require('request');
var cheerio = require('cheerio');
var _       = require('lodash');
var CronJob = require('cron').CronJob;

// get steam member list every hour
new CronJob('0 * * * *', function() {
  getMemberList(1);
}, null, true, 'America/Los_Angeles');
// get leaderboard data every hour
new CronJob('0 * * * *', function() {
  scrapeData('1300627020', '2219682419', 1);
}, null, true, 'America/Los_Angeles');

var mongo = require('mongodb');
var monk = require('monk');
var db = monk('localhost:27017/blacklist');

var router = express.Router();

/* GET home page. */
router.get('/', function (req, res) {
  var leaderboard = db.get('leaderboard');
  var members = db.get('members');
  leaderboard.find({}, {}, function (err, data) {
    var leaderboardData = data;
    members.find({}, {}, function (err, data) {
      var memberData = _.map(data, function (data) { return data.username });
      var filtered = _.findByValues(leaderboardData, 'username', memberData);
      res.render('view', {
        'leaderboardData': _.sortBy(filtered, 'time')
      });
    });
  });
});

router.get('/scrape', function (req, res) {
  res.render('scrape');
});

router.get('/scrape/start', function (req, res) {
  scrapeData(req.query.track, req.query.car, 1);
  res.redirect('/scrape');
});

router.get('/scrape/members', function (req, res) {
  getMemberList(1);
  res.redirect('/view');
});

/*====== utils =====*/

function scrapeData (track, car, page) {
  var collection = db.get('leaderboard');
  var url = 'http://cars-stats-steam.wmdportal.com/index.php/leaderboard?track=' + track + '&vehicle=' + car + '&page=' + page;

  console.log('Scraping leaderboard page: ' + page);
  request(url, function (err, res, html) {
    if (!err) {
      var $ = cheerio.load(html);
      var data;

      if ($('#leaderboard tbody tr td.rank').length) {
        $('#leaderboard tbody tr').each(function () {
          $this = $(this);
          var username = $this.find('td.user a').html();
          var steamURL = $this.find('td.user a').attr('href');
          var sector = $this.find('td.time').attr('title').split('\n');
          var time = $this.find('td.time span.time').html();
          var gap = $this.find('td.gap span.gap').html();
          var assists = $this.find('td.assists img').last().attr('title');
          var timestamp = $this.find('td.timestamp').html();
          var vehicle = $this.find('td.vehicle a').html() === 0 ? $this.find('td.vehicle a').html() : car;

          var data = {
            'username': username,
            'steamURL': steamURL,
            'track': track,
            'vehicle': vehicle,
            'sectors': [
              sector[0],
              sector[1],
              sector[2]
            ],
            'time': time,
            'gap': gap,
            'assists': assists,
            'timestamp': timestamp
          };
          //collection.insert(data);
          collection.update(
            { username: username },
            data,
            { upsert: true }
          );
        });

        scrapeData(track, car, ++page);
      } else {
        console.log('Leaderboard scrape completed.');
      }
    } else {
      console.log(err);
    }
  });
}

function getMemberList (page) {
  var collection = db.get('members');
  var url = 'http://steamcommunity.com/groups/redditracing/members/?p=';

  console.log('Scraping leaderboard page: ' + page);
  request(url + page, function (err, res, html) {
    if (!err) {
      var $ = cheerio.load(html);
      var members;

      if ($('.member_block').length) {
        $('.member_block').each(function () {
          $this = $(this);

          var username = $this.find('.member_block .member_block_content div a.linkFriend').html();
          var steamURL = $this.find('.member_block .member_block_content div a.linkFriend').attr('href');
          var data = {
            'username': username,
            'steamURL': steamURL
          };

          collection.update(
            { username: username },
            data,
            { upsert: true }
          );
        });

        getMemberList(++page);
      } else {
        console.log('Memberlist scrape completed.');
      }
    } else {
      console.log(err);
    }
  });
}

_.mixin({
  'findByValues': function(collection, property, values) {
    return _.filter(collection, function(item) {
      return _.contains(values, item[property]);
    });
  }
});


module.exports = router;
