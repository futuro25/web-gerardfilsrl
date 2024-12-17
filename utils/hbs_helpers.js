const   hbs = require('hbs');

hbs.registerHelper('has_promotions', function(cart, options) {
    const promotions = cart.products.filter( function(product) { return product.promotion && product.promotion.status == 'VALID'; } );
    return promotions.length ? options.fn(this) : options.inverse(this);
});

hbs.registerHelper('has_bonification', function(cart, options) {
    const bonifications = cart.products.filter( function(product) { return product.price_matching_discount; } );
    return bonifications.length ? options.fn(this) : options.inverse(this);
});

hbs.registerHelper('formatCreditCardName', function(str) {

        if (!str) return;

        let cleanCharacters = function (string) {

            if(!cleanCharacters.translate_re) cleanCharacters.translate_re = /[áéíóúñÁÉÍÓÚÑ]/g;
            var translate = {
                "á": "a", "é": "e", "í": "i", "ó": "o", "ú": "u", "ñ": "n",
                "Á": "A", "É": "E", "Í": "I", "Ó": "O", "Ú": "U", "Ñ": "N"   // probably more to come
            };

            return ( string.replace(cleanCharacters.translate_re, function(match) {
                return translate[match];
            }) );
        },
        creditCardName = cleanCharacters(str);

    return creditCardName.toLowerCase().split(" ").join("-").trim();
});

hbs.registerHelper("select", function(value, options) {
    return options.fn(this)
        .split('\n')
        .map(function(v) {
            var t = 'value="' + value + '"'
            return v.replace(t, t + ' selected="selected"');
        })
        .join('\n')
});

hbs.registerHelper("warranty", function(value, options) {
    return options.fn(this)
        .split('\n')
        .map(function(v) {
            var t = 'value="' + value + '"'
            return ! RegExp(t).test(v) ? v : v.replace(t, t + ' checked="checked"')
        })
        .join('\n')
});

// This helper is exactly the same to "warranty".
hbs.registerHelper("radioSelected", function(value, options) {
	return options.fn(this)
		.split('\n')
		.map(function(v) {
			var t = 'value="' + value + '"'
			return ! RegExp(t).test(v) ? v : v.replace(t, t + ' checked="checked"')
		})
		.join('\n')
});


hbs.registerHelper('if_not', function(a, opts) {
    if(a){ // Or === depending on your needs
        return opts.inverse(this);
    }else{
        return opts.fn(this);
    }
});

hbs.registerHelper('if_eq', function(a, b, opts) {
    if(a == b) // Or === depending on your needs

        return opts.fn(this);
    else
        return opts.inverse(this);
});

hbs.registerHelper('if_gt', function(a, b, opts) {
    if(a > b) // Or === depending on your needs
        return opts.fn(this);
    else
        return opts.inverse(this);
});

hbs.registerHelper('if_regex', function(a, regexp, opts) {
    if(a.match(regexp)){
    // Or === depending on your needs
        return opts.fn(this);
    }
    else{
        return opts.inverse(this);
    }
});


hbs.registerHelper('if_in_list', function(a, b, opts) {
    if(b.split(',').indexOf(''+a) != -1 ) // Or === depending on your needs
        return opts.fn(this);
    else
        return opts.inverse(this);
});

hbs.registerHelper('unless_eq', function(a, b, opts) {
    if(a != b) { //Or === depending on your needs
        return opts.fn(this);
    } else {
        return opts.inverse(this);
    }
});

hbs.registerHelper('delivery_compare', function (a, b, opts) {
    "use strict";

    a = (a == "PICKUP_DEFERRED") ? "PICKUP" : a;

    if(a == b) // Or === depending on your needs
        return opts.fn(this);
    else
        return opts.inverse(this);

});

hbs.registerHelper('priceGreaterThanZero', function (price, opts) {
    if (+price > 0) {
        return opts.fn(this);
    } else {
        return opts.inverse(this);
    }
});

hbs.registerHelper('conditional', function (v1, operator, v2, options) {

    switch (operator) {
        case '==':
            return (v1 == v2) ? options.fn(this) : options.inverse(this);
        case '===':
            return (v1 === v2) ? options.fn(this) : options.inverse(this);
        case '!=':
            return (v1 != v2) ? options.fn(this) : options.inverse(this);
        case '!==':
            return (v1 !== v2) ? options.fn(this) : options.inverse(this);
        case '<':
            return (v1 < v2) ? options.fn(this) : options.inverse(this);
        case '<=':
            return (v1 <= v2) ? options.fn(this) : options.inverse(this);
        case '>':
            return (v1 > v2) ? options.fn(this) : options.inverse(this);
        case '>=':
            return (v1 >= v2) ? options.fn(this) : options.inverse(this);
        case '&&':
            return (v1 && v2) ? options.fn(this) : options.inverse(this);
        case '||':
            return (v1 || v2) ? options.fn(this) : options.inverse(this);
        case '!||':
            return !(v1 || v2) ? options.fn(this) : options.inverse(this);
        case '!=!':
            return (v1.indexOf(v2) != -1) ? options.fn(this) : options.inverse(this);
        case '!==!':
            return (v1.indexOf(v2) == -1) ? options.fn(this) : options.inverse(this);
        default:
            return options.inverse(this);
    }
});

hbs.registerHelper('each_sort_warranties', function (array, opts) {

    var key = "coverage_period";

    array.sort(function (a, b) {

        if ( parseInt(a[key]) > parseInt(b[key]) ) {
            return 1;
        }
        if ( parseInt(a[key]) < parseInt(b[key]) ) {
            return -1;
        }
        // a must be equal to b
        return 0;
    })

    var s = '';

    for (var i = 0; i < array.length; i++) {
        s += opts.fn(array[i]);
    }

    return s;
});

hbs.registerHelper('hasWarranty', function (value, options) {

    var warranty = options.hash["warranty"],
        index    = options.hash["index"],
        indexIs0 = index === 0,
        warrantyIsNotDefault = warranty !== "DEFAULT_FACTORY";

    return (indexIs0 || warrantyIsNotDefault) ? options.fn(this) : options.inverse(this);
});


hbs.registerHelper('translateWarranty', function (value, extraString, options) {
   var period = parseInt(value, 10),
       returnValue,
       warranty_strings = {
            warranty3   : "3 meses",
            warranty6   : "6 meses",
            warranty12  : "1 año",
            warranty24  : "2 años",
            warranty36  : "3 años",
            warranty48  : "4 años",
            warranty60  : "5 años",
            warranty72  : "6 años",
            warranty120 : "10 años"
        };

        returnValue = warranty_strings["warranty" + period];


        if (typeof returnValue !== "undefined") {

            //ExtraString becomes an object instead of undefined if it's empty. So comparing against an object.
            if (typeof extraString !== "object") {
                return extraString + " " + returnValue;
            } else {
                return returnValue;
            }

        } else {
            return period + " meses";
        }

});

hbs.registerHelper('translateWarrantyMonth', function (value, extraString, options) {
   var period = parseInt(value, 10),
       returnValue,
       warranty_strings = {
            warranty3   : "3 meses",
            warranty6   : "6 meses",
            warranty12  : "12 meses",
            warranty24  : "24 meses",
            warranty36  : "36 meses",
            warranty48  : "48 meses",
            warranty60  : "60 meses",
            warranty72  : "72 meses",
            warranty120 : "120 meses"
        };

        returnValue = warranty_strings["warranty" + period];


        if (typeof returnValue !== "undefined") {

            //ExtraString becomes an object instead of undefined if it's empty. So comparing against an object.
            if (typeof extraString !== "object") {
                return extraString + " " + returnValue;
            } else {
                return returnValue;
            }

        } else {
            return period + " meses";
        }

});

hbs.registerHelper('warrantyLegend', function (value, defaultWarrantyValue) {
    var period = parseInt(value, 10),
        defaultPeriod = parseInt(defaultWarrantyValue, 10),
        returnValue,
        defaultWarranty,
        warranty_strings = {
            warranty3   : "3 meses",
            warranty6   : "6 meses",
            warranty12  : "1 año",
            warranty24  : "2 años",
            warranty36  : "3 años",
            warranty48  : "4 años",
            warranty60  : "5 años",
            warranty72  : "6 años",
            warranty120 : "10 años"
        };

    returnValue = warranty_strings["warranty" + period];
    defaultWarranty = warranty_strings["warranty" + defaultPeriod];


    if (typeof returnValue !== "undefined") {
        return new hbs.SafeString("Elegiste Garantía de reparación por <b>" + returnValue +"</b>");
    } else {

        if (typeof defaultWarranty !== "undefined") {
            return new hbs.SafeString("Tenés garantía de fábrica incluída (<b>" + defaultWarranty + "</b>)");
        } else {
            return new hbs.SafeString("Tenés garantía de fábrica incluída");
        }
    }

});

hbs.registerHelper('showCreditCard', function(creditCardName, showCreditoCookie, opts){
    var regex = new RegExp('[cC]r[eé]dito*.*');
    var isCreditoPropio = regex.test(creditCardName);
    if(!isCreditoPropio || (isCreditoPropio && showCreditoCookie == true)){
        return opts.fn(this);
    } else {
        return opts.inverse(this);
    }
});

hbs.registerHelper('showThirdStepCardMessage', function(deliveries, payments, hasOwnCreditPayment){
    var message = "";
    if(deliveries && deliveries.length > 0 && payments && payments.length > 0){
        if(["PICKUP", "PICKUP_DEFERRED"].includes(deliveries[0].delivery_type)){
            if(payments[0].payment_method_id == 65 || payments[0].payment_method_id == 81 || hasOwnCreditPayment){
                message = "El pedido será entregado únicamente al titular de la compra presentando el número de pedido y documento."
            }else{
                message = "El pedido será entregado únicamente al titular de la compra presentando el número de pedido, documento y tarjeta utilizada.";
            }
        }else{
            message = "El pedido será entregado únicamente al titular de la compra o a la persona autorizada presentando el documento.";
        }
    }

    return message;
});

hbs.registerHelper('showCouponDiscount', function(coupons, opts){

    if(coupons && coupons[0] && coupons[0].status == "VALID"){
        return opts.inverse(this);
    } else {
        return opts.fn(this);
    }
});

hbs.registerHelper('formatPriceIVa', function(param1, operator ,param2){

    var value = 0;

    switch (operator) {
        case '+':
            value= param1 + param2;
        case '-':
            value= param1 - param2;
        case '*':
            value= param1 * param2;
        case '/': {
            if(param2 != 0){
                value= param1 / param2;
            }else{
                value= param1;
            }
        }
        default:
            //por default Suma
            value= param1 - param2;
    }

    //If value is undefined return undefined
    if (typeof value === 'undefined') { return }

    var currency = "$",
        n = 0,
        x = 3,
        s = ".",
        c = "";

    var re = '\\d(?=(\\d{' + (x || 3) + '})+' + (n > 0 ? '\\D' : '$') + ')',
        num = value.toFixed(Math.max(0, ~~n));

    //Adding currency
    num = currency + num;

    return (c ? num.replace('.', c) : num).replace(new RegExp(re, 'g'), '$&' + (s || ','));
});

hbs.registerHelper('formatPrice', function (value) {

    /**
     * Number.prototype.format(n, x, s, c)
     *
     * @param integer n: length of decimal
     * @param integer x: length of whole part
     * @param mixed   s: sections delimiter
     * @param mixed   c: decimal delimiter
     */

    //If value is undefined return undefined
    if (typeof value === 'undefined') { return }

    var currency = "$",
        n = 0,
        x = 3,
        s = ".",
        c = "";

    var re = '\\d(?=(\\d{' + (x || 3) + '})+' + (n > 0 ? '\\D' : '$') + ')',
        num = value.toFixed(Math.max(0, ~~n));

    //Adding currency
    num = currency + num;

    return (c ? num.replace('.', c) : num).replace(new RegExp(re, 'g'), '$&' + (s || ','));

});

hbs.registerHelper('formatSurchargeCost', function (value) {

    /**
     * Number.prototype.format(n, x, s, c)
     *
     * @param integer n: length of decimal
     * @param integer x: length of whole part
     * @param mixed   s: sections delimiter
     * @param mixed   c: decimal delimiter
     */

    //If value is undefined return undefined
    if (typeof value === 'undefined') { return }

    var n = 0,
        x = 3,
        s = ".",
        c = ",";

    var re = '\\d(?=(\\d{' + (x || 3) + '})+' + (n > 0 ? '\\D' : '$') + ')',
        num = value.toFixed(Math.max(0, ~~n));

    return (c ? num.replace('.', c) : num).replace(new RegExp(re, 'g'), '$&' + (s || ''));

});

hbs.registerHelper('ifListPrice', function(v1, v2, options) {
    if(v1 > (Math.ceil(v2+1))) {
        return options.fn(this);
    }
    return null;
});



/**
 * @name toJSON.
 * @description Parse to JSON objects.
 * @return [Object] Parsed
 */
hbs.registerHelper('toJSON', (context) => {
    "use strict";
    return JSON.stringify(context);

});

hbs.registerHelper('calculateWarrantyInstallment', (price, porcentaje) => {
    var interest = (parseFloat(porcentaje) * parseFloat(price)) / 100;
    var newPrice = (price + interest) / 12;
    return "$" + Math.ceil(newPrice);
});

hbs.registerHelper('brandLowercase', (brand) => {
    if (typeof brand !== 'undefined') {  return brand.toLowerCase(); }
    return brand;
});

hbs.registerHelper('brandToUpperCase', (brand) => {
    if (typeof brand !== 'undefined') {  return brand.toUpperCase(); }
    return brand;
});

hbs.registerHelper('brandCapitalize', (brand) => {
    return capitalizeOnlyFirst(brand);
});

hbs.registerHelper('doMath', (operator, param1, param2) => {
    "use strict";
    var response;
    
    switch (operator) {
        case '+':
            response = parseInt(param1) + parseInt(param2);
        break;
        case '-':
            response = parseInt(param1) - parseInt(param2);
        break;
        case '*':
            response = parseInt(param1) * parseInt(param2);
        break;
        case '/': {
            if(param2 != 0){
                response = parseInt(param1) / parseInt(param2);
            }else{
                response = parseInt(param1);
            }
        }
        break;
        default:
            //por default Suma
            response = parseInt(param1) + parseInt(param2);
    }
    
    return Number(response).toLocaleString('es').replace(",", ".");
});

hbs.registerHelper('formatPriceNumber', (param1) => {
    "use strict";
    return Number(param1).toLocaleString('es').replace(",", ".");
});

/**
 * @name getSuffixInfo
 * @description Check if exists products  / warranties and return information  about quantity
 * @param  obj - [Object] (CART)
 * @param flag - [String] (producto \ garantia)
 * @return [String]
 */
hbs.registerHelper('getSuffixInfo', (obj, flag) => {
    "use strict";
    let _obj = obj;
    let _flag = flag;
    let _qty = obj.length;
    let _warranties = 0;
    const checkWarranties =  (object) => {
        object.forEach((i) => {
            if(i.hasOwnProperty('warranty_id') && i.warranty_id !== 'DEFAULT_FACTORY') {
                _warranties ++;
            }
        })
    };

    if(_obj === 'undefined') { return }
    else {
       if (_flag === 'producto') {
           if(_qty === 0 || _qty > 1) {
               return `${_qty} productos`;
           } else {
               return `${_qty} producto`;
           }
       } else {
           checkWarranties(_obj);
           if(_warranties == 0 || _warranties > 1) {
                return `${_warranties} unidades`;
           } else {
                return `${_warranties} unidad`;
           }
       }
    }

});

hbs.registerHelper('genderFormat', function(gender) {
    switch (gender){
        case "MALE":return "Masculino"
        break;
        case "FEMALE":return "Femenino"
        break;
    }

});


hbs.registerHelper('isMercadoPago', function(paymentOption, opts) {
    if(paymentOption && (paymentOption.id == "160" || paymentOption.id == "57")){
        return opts.fn(this);
    } else {
        return opts.inverse(this);
    }
});


hbs.registerHelper('isOffer', function(price_a, price_b) {
    if(a > b){
        return true;
    }else{
        return false;
    }
});


hbs.registerHelper('getOffer', function(price_a, price_b) {
    return 100-(price_a*100/price_b);
});

hbs.registerHelper('json', function(context) {
    return JSON.stringify(context);
});

hbs.registerHelper('pretty_list', function (array, opt, opt2) {
    if (typeof array !== 'undefined') {
        var str = array.join(" " +opt);
        var replacement = opt2;
        str = str.replace(/,([^,]*)$/, replacement + '$1');
        return str;
    }
});

hbs.registerHelper('formatInstallmentDiscount', function (installment_summary) {
    if (typeof installment_summary !== 'undefined' && installment_summary.installment_summary_data !== 'undefined'){
        var withDiscount = getInstallmentsWithDiscount(installment_summary.installment_summary_data);
        var ptrn = "P% off en C cuotas ";

        if (withDiscount.length > 0) {
            var str = "+ ";
            if(!installment_summary.general_discount){

                for (var i = 0; i < withDiscount.length; i++) {
                    if (i != 0)
                        str += "o ";

                    str += ptrn;
                    str = str.replace(/C/g, withDiscount[i].installments);
                    str = str.replace(/P/g, withDiscount[i].discount);
                }
            }else{
                str += ptrn;
                str = str.replace(/en C cuotas/g, "");
                str = str.replace(/P/g, withDiscount[0].discount);
            }
        }
        return str;
    }
});

hbs.registerHelper('formatInstallmentTFCzero', function (installment_summary) {
    if (typeof installment_summary.installment_summary_data !== 'undefined'){
        var str = "¡";
        var zeroInstallments = getZeroInstallments(installment_summary.installment_summary_data);

        if(!installment_summary.general_tfczero) {
            str += prettyList(zeroInstallments, " , ", " y ");
        }
        str += "sin interés!"
        return str;
    }
});

function prettyList(array, opt, opt2) {
    if (typeof array !== 'undefined') {
        var str = array.join(" " + opt);
        var replacement = opt2;
        str = str.replace(/,([^,]*)$/, replacement + '$1');
        return str + " ";
    }
}

function getZeroInstallments(installment_summary_data){
    var zeroInstallments = [];

    for (var i = 0; i < installment_summary_data.length; i++) {
        //sacamos "en 1 couta"
        if(installment_summary_data[i].tfc_zero && installment_summary_data[i].installments > 1) {
            zeroInstallments.push(installment_summary_data[i].installments);
        }
    }
    return zeroInstallments;
}

function getInstallmentsWithDiscount(installment_summary_data){
    return installment_summary_data.filter(function(el){
        return el.discount > 0;
      });
}

function capitalizeOnlyFirst(string)
{
    return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase();
}
