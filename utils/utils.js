"use strict"

var Q             = require("q"),
    logger        = require('../utils/logger'),
    config      = require('../config/config'),
    NodeCache     = require('node-cache'),
    myCache       = new NodeCache(),
    self          = {};

self.getSeoUrl = function(name) {
    let seo_name = name.toLowerCase();
    seo_name = seo_name.replace(/ /g, '-');
    seo_name = seo_name.replace(/&/g, 'y');
    seo_name = seo_name.replace(/ñ/g, 'n');
    seo_name = seo_name.replace(/lts/g, '-litro');

    seo_name = seo_name.replace(/á/g, 'a');
    seo_name = seo_name.replace(/é/g, 'e');
    seo_name = seo_name.replace(/í/g, 'i');
    seo_name = seo_name.replace(/ó/g, 'o');
    seo_name = seo_name.replace(/ú/g, 'u');

    seo_name = seo_name.replace(/à/g, 'a');
    seo_name = seo_name.replace(/è/g, 'e');
    seo_name = seo_name.replace(/ì/g, 'i');
    seo_name = seo_name.replace(/ò/g, 'o');
    seo_name = seo_name.replace(/ù/g, 'u');

    return seo_name;
};

self.getBrand = () => {
    return process.env.APP_BRAND.toLowerCase();
}

self.getEnv = () => {
    return process.env.APP_ENV.toLowerCase();
}

module.exports = self;