"use strict";

let self = {};
var base_url = process.env.APP_BASE_URL || 'http://localhost:5005';

self.config = {
	metas: {
		title: ". : Gerardfil SRL : .",
		color: "#000000",
		url_site: base_url + "/",
		// og_image: "https://i.postimg.cc/fLBM1fLs/photo-2024-12-16-23-37-24.jpg",
		og_image: "",
		canonical: "http://gerardfilsrl.com.ar/",
		description: "Gerardfil SRL",
	},
	sitePathCom: base_url,
	sitePathComAr: base_url,
	sitePath: base_url,
	sourcePath: base_url + "/statics",
	phoneChat: "",
	portfolio: "",
};

module.exports = self;
