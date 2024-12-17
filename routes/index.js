"use strict"

const express = require('express');
const router = express.Router();
const uaparser = require('ua-parser-js');
const main = require('../controllers/MainController');


router.all('*', function (req, res, next) {

    let app = req.app,
        ua = new uaparser(req.get('User-Agent'));

    if (ua.getDevice().type === "mobile" || ua.getDevice().type === "wearable" || ua.getDevice().type === "embedded") {
        res.locals.device = "mobile";
    } else {
        res.locals.device = "desktop";
    }
    console.log("Device => ", res.locals.device);
    next();
});

//FRONT  ========================================================================================
router.get('/', (req, res, next) => main.home(req, res, next));
router.get('/contacto', (req, res, next) => main.home(req, res, next));
router.get('/index', (req, res, next) => main.home(req, res, next));
router.get('/home', (req, res, next) => main.home(req, res, next));
router.get('/sitemap.xml', (req, res, next) => main.sitemap(req, res, next));

router.get('/home.htm', (req, res, next) => main.home(req, res, next));
router.get('/ubicacion.htm', (req, res, next) => main.home(req, res, next));
router.get('/mod_trabajo.htm', (req, res, next) => main.home(req, res, next));
router.get('/fotos.htm', (req, res, next) => main.home(req, res, next));
router.get('/ingresar.php', (req, res, next) => main.home(req, res, next));
router.get('/revistas.htm', (req, res, next) => main.home(req, res, next));
router.get('/contacto.htm', (req, res, next) => main.home(req, res, next));
router.get('/mapa.htm', (req, res, next) => main.home(req, res, next));


module.exports = router;


// somosvos.org
// rectangular-lobster-w0dgsrsb0df1rt8a7gnbtan3.herokudns.com

// www.somosvos.org
// secret-island-oyv2k50p481cb40jp7baewop.herokudns.com

// www.somosvos.com
// round-plum-e4wyujnfxwfotm3vlf8lv9ge.herokudns.com


// somosvos.com
// computational-chicken-gaai1ewld4kqllx0ptfo3cgp.herokudns.com
