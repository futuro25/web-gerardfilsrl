"use strict"

const config = require('../config/config');
const self = {};
const hbsUtils = require('hbs');
const fs = require('fs');


// HOME
self.sitemap = (req, res) => {
	res.type('application/xml');
	res.send('<?xml version="1.0" encoding="UTF-8"?> <urlset xmlns="https://www.sitemaps.org/schemas/sitemap/0.9"> <url><loc>http://www.somosvos.org</loc></url></urlset>');
}

self.home = (req, res) => {
	const section = req.originalUrl.replace("/", "");
	var template = hbsUtils.compile(fs.readFileSync('views/home.hbs', 'utf8'));
	var context = { config: config, device: res.locals.device, section: section };
	var html = template(context);
	res.send(html);
};


module.exports = self;