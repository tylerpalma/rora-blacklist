"use strict";

let express = require('express');
let fs      = require('fs');
let request = require('request');
let cheerio = require('cheerio');
let _       = require('lodash');
let CronJob = require('cron').CronJob;

let mongo = require('mongodb');
let monk = require('monk');
let db = monk('localhost:27017/blacklist');

let router = express.Router();

// set track/car combo
// eventually add some fucking objects to hold the track and car IDs with pretty names
const config = {
  track: '2509185801',
  car: '2976119256'
};

{
  // get steam member list every hour
  new CronJob('1 * * * *', () => {
    getMemberList(1);
  }, null, true, 'America/Los_Angeles');
  // get leaderboard data every hour
  new CronJob('1 * * * *', () => {
    scrapeData(config.track, config.car, 1);
  }, null, true, 'America/Los_Angeles');

  // set mixin
  _.mixin({
    'findByValues': (collection, property, values) =>
      _.filter(collection, item =>
        _.contains(values, item[property]))
  });
}

/* GET home page. */
router.get('/', (req, res) => {
  let leaderboard = db.get('leaderboard');
  let members = db.get('members');
  leaderboard.find(_.pick(config, 'track', 'car'), {}, (err, data) => {
    let leaderboardData = data;
    members.find({}, {}, (err, data) => {
      let memberData = data.map(data => data.username);
      let filtered = _.findByValues(leaderboardData, 'username', memberData);
      let sorted = _.sortBy(filtered, 'time');
      res.render('view', {
        'leaderboardData': sorted
      });
    });
  });
});

// for manually triggering a lb scrape
router.get('/scrape/leaderboards', (req, res) => {
  scrapeData(config.track, config.car, 1);
  res.redirect('/');
});

// for manually triggering a steam member scrape
router.get('/scrape/members', (req, res) => {
  getMemberList(1);
  res.redirect('/');
});

/*====== utils =====*/
function scrapeData (track, car, page) {
  let collection = db.get('leaderboard');
  let url = 'http://cars-stats-steam.wmdportal.com/index.php/leaderboard?track=' + track + '&vehicle=' + car + '&page=' + page;

  console.log('Scraping leaderboard page: ' + page);
  request(url, (err, res, html) => {
    if (err) return console.log(err);

    let $ = cheerio.load(html);

    if ($('#leaderboard tbody tr td.rank').length) {
      $('#leaderboard tbody tr').each(() => {
        let $this = $(this);
        let username = $this.find('td.user a').html();
        let steamURL = $this.find('td.user a').attr('href');
        let sector = $this.find('td.time').attr('title').split('\n');
        let time = $this.find('td.time span.time').html();
        let gap = $this.find('td.gap span.gap').html();
        let assists = $this.find('td.assists img').last().attr('title');
        let timestamp = $this.find('td.timestamp').html();
        let car = config.car;
        let data = {
          username, steamURL, track, car, time, gap, assists, timestamp,
          'sectors': [
            trimSector(sector[0]),
            trimSector(sector[1]),
            trimSector(sector[2])
          ]
        };

        collection.update({username}, data, {upsert: true});
      });

      scrapeData(track, car, ++page);
    } else {
      console.log('Leaderboard scrape completed.');
    }
  });
}

function getMemberList (page) {
  let collection = db.get('members');
  let url = 'http://steamcommunity.com/groups/redditracing/members/?p=';

  console.log('Scraping leaderboard page: ' + page);
  request(url + page, (err, res, html) => {
    if (err) return console.log(err);

    let $ = cheerio.load(html);
    let members;

    if ($('.member_block').length) {
      $('.member_block').each(() => {
        let $this = $(this);
        let username = $this.find('.member_block .member_block_content div a.linkFriend').html();
        let steamURL = $this.find('.member_block .member_block_content div a.linkFriend').attr('href');
        let data = {
          'username': username,
          'steamURL': steamURL
        };

        collection.update({username}, data, {upsert: true}
        );
      });

      getMemberList(++page);
    } else {
      console.log('Memberlist scrape completed.');
    }
  });
}

function trimSector (string) {
  let strings = string.trim().split(':');
  if (strings[1] === '0') return strings[2];
  return strings[1] + ':' + strings[2];
}

module.exports = router;
