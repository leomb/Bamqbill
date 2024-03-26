window.bamBill = (function() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js').then(reg => {

            Notification.requestPermission(status => {
                if (status === 'granted') {
                    new Notification('Howdy!');
                    reg.showNotification('Hello, there');
                }
            })

            console.log('Service Worker successfully registered');
        }).catch(err => {
            console.log('Error while registering Service Worker');
        });
    }
 
    // get the 12 most recent work order authorizations from the database
    let formData = new FormData(); 
    formData.append("operation","getAuthorizations");
    formData.append("f_type","request");
    fetch("./process/ajax.php",
        {
            body: formData,
            method: "post"
        })
        .then((response) => response.json())
    .then((json) => createCustomerDropdown(json))
    .catch(err => {
        console.log(`Error getting Authorizations. ${err}`)
    });

    // get the rates to use in the invoice
    fetch('./data/bamrates.json')
    .then((response) => response.json())
    .then((json) => initRates(json))
    .catch(err => {
        console.log(`Error getting bamrates: ${err}`)
    });

    const isOffline = false;
    window.addEventListener('offline', e => {
        isOffline = true;
        console.log('We are offline.');
    });

    window.addEventListener('online', e => {
        isOffline = false;
        console.log('We are online.');
    });

  
})();

// Date function
function setTodaysDate() {
    const today = new Date();
    var dateISO = today.toISOString();
    var dateParts = dateISO.split("T");
    return dateParts[0];
}
document.getElementById('date').value = setTodaysDate();

let country = document.forms[0].outOfCountry.value == "ON" ? "foreign" : "usa";
let laborRate = document.forms[0].labor.value;
let invoiceData = new FormData(document.forms[0]);

// rates
var varRates, flatRates;

function initRates(file) {
    varRates = file[0];
    flatRates = file[1];
    setValues(); // put the rates in the input attributes on the form
}

// set values
function setValues() {
    setRtsCosts(flatRates);
    setFuelCosts(flatRates);
    setExtraCosts(flatRates);
    setOilCosts(flatRates);
    setVariableCosts(varRates[country][laborRate]);
    setBodyCosts(flatRates);
}

// W/O Authorization
const authorization = document.getElementById('authorizations');
authorization.addEventListener("change", populate);

function populate(e) {
    let id = e.target.value;
    let customer = getCustomer(id);
    document.getElementById('customer').value = customer.customer;
    document.getElementById('service-requested').value = customer.service;
    document.getElementById('signee').innerHTML = customer.signature;
    document.getElementById('signee2').innerHTML = customer.signature;
    document.getElementById('txCustEmail').innerHTML = customer.email;
    setHiddenField('customer_email', customer.email);
    setHiddenField('registration', customer.registration);
    setHiddenField('customer_name', customer.signature);
   
    const location = document.forms[0].location.value;
    const invoiceDate = document.getElementById('date').value.substring(5);
    const invoiceName = "INV" + document.getElementById('date').value.substring(5,2);
    document.getElementById('invoice-number').innerHTML = `${invoiceName +  invoiceDate}${location}`;
    setHiddenField('inv_number', document.getElementById('invoice-number').innerHTML);

    if (e.target.value > "") {
        e.target.classList.remove('attention');
    }
}

function getCustomer(id) {
    if ( id == "Please choose...") {
        return {registration: "", customer: "", email: "", service: "", signature: ""};
    }
    return testData[id];
}

var testData = {
    1: {registration: "C-FTJP", customer: "Frank Spinello\nNovajet Aviation Group\nMississauga, Ontario, Canada L5S 1B2", email: "frankspinello@novajet.ca", service: "Refueling of the aux & tail tank intermittent. External refuel/defuel panel U/S. No power to panel", signature: "Frank Spinello"},
    2: {registration: "N143PM", customer: "John Huynh\n525 S Flagler dr\nUnited States", email: "N143PM@gmail.com", service: "Maybe needs a new battery. Doesn't start, electrical concern.", signature: "John Huynh"},
    3: {registration: "N98BT", customer: "Lord Alan Sugar\nAmsprop USA Holding Inc\nBoca Raton Florida 33432", email: "ams@amshold.com", service: "pre purchase inspection", signature: "Lord Alan Sugar"}
}

// Signature Canvas
const canvas = document.querySelector("canvas");

const signaturePad = new SignaturePad(canvas, {
    minWidth: 3,
    maxWidth: 5,
    penColor: "rgb(66, 133, 244)",
    backgroundColor: "rgb(255, 255, 255)"
});

// Checkboxes, radios, and inputs
const oilServices = document.querySelectorAll('input[name^="oil"]');
const bodyservice = document.querySelectorAll('input[name="body[]"]');
const quantities = document.querySelectorAll('input[type="number"]:not(#labor-hrs,#fuel-qty');
const qtylabor = document.getElementById('labor-hrs');
const radios = document.querySelectorAll('input[type="radio"]:not([name=location])');
const locations = document.querySelectorAll('input[name=location]');
const laborBase = document.querySelectorAll('input[name=labor]');
const rts = document.querySelectorAll('input[name=rts]');
const fuel = document.querySelectorAll('input[name=fuel');
const qtyfuel = document.getElementById('fuel-qty');
const otherChecks = document.querySelectorAll('input[name="callout"],input[name="extrafees[]"],input[name="o2-service"]');
const otherService = document.getElementById('additional-amount');
const largeCabin = document.getElementById('largeCabin');
const origin = document.getElementById('outOfCountry');
const form = document.forms[0];
const SALESTAX = 0.07;

function setHiddenField(name, value) {
    if ( undefined === form[name] ) {
        var hinput = document.createElement('input');
        hinput.setAttribute("type", "hidden");
        hinput.setAttribute("name", name);
        hinput.value = value;
        form.appendChild(hinput);
    } else {
        form[name].value = value;
    }
}


oilServices.forEach(oilService => {
    oilService.addEventListener("change", () => {
        // get quanity element
        if (oilService.parentElement.parentElement.nextElementSibling !== null)
            var qty = oilService.parentElement.parentElement.nextElementSibling.firstElementChild;
        if (qty !== undefined && qty.type !== "checkbox") {
            if (oilService.checked) {
                qty.disabled = false;
                console.log("Qty enabled");
            } else {
                qty.disabled = true;
                console.log("Qty disabled");
            }
            qty.value = 0;
        }
        // addition or subtraction?
        let operation = oilService.checked ? "+" : "-";
        calculateBill(oilService.dataset['cost'], oilService.dataset['display'], operation);
    });
});

bodyservice.forEach(serv => {
    serv.addEventListener("change", () => {
        let operation = serv.checked ? "+" : "-";
        calculateBill(serv.dataset['cost'], serv.dataset['display'], operation);
    });
});

otherChecks.forEach(otherCheck => {
    otherCheck.addEventListener("change", () => {
        let operation = otherCheck.checked ? "+" : "-";
        calculateBill(otherCheck.dataset['cost'], otherCheck.dataset['display'], operation);
    });
});

laborBase.forEach(base => {
    base.addEventListener("change", () => {
        var qty = document.getElementById("labor-hrs");
        document.getElementById("amount-labor").innerHTML = "";
        laborRate = base.value;
        if ( largeCabin.checked ) {
            qty.dataset['cost'] = varRates[country][laborRate].aog;
        } else {
            qty.dataset['cost'] = varRates[country][laborRate].hrs;
        }
        let operation = "*";
        calculateBill(Number(qty.dataset['cost'] * qty.value), qty.dataset['display'], operation);
        var newRate = varRates[country][laborRate];
        updateInvoice(newRate);
    });
});

largeCabin.addEventListener("change", () => {
    updateLabor(varRates[country][laborRate]);
    updateOrigin(varRates[country][laborRate]);
});

origin.addEventListener("change", () => {
    if ( origin.checked ) {
        country = "foreign";
    } else {
        country = "usa";
    }
    var laborRate = document.forms[0].labor.value;
    var newRate = varRates[country][laborRate];
    console.log(`Changed origin: ${country}, ${laborRate}`);
    updateLabor(newRate);
    updateOrigin(newRate);
});

rts.forEach(radio => {
    radio.addEventListener("change", () => {
        var currentValue = document.getElementById('amount-rts').innerHTML;
        let currentCost = currentValue == "" ? 0 : Number(currentValue);
        let operation = "+"
        calculateBill(Number(radio.dataset['cost']) - currentCost, radio.dataset['display'], operation);
        return;
    });
});

fuel.forEach(gas => {
    gas.addEventListener("change", () => {
        var qty = document.getElementById('fuel-qty');
        qty.disabled = false;
        let operation = "*"
        calculateBill(Number(Number(gas.dataset['cost']) * Number(qty.value)), gas.dataset['display'], operation);
        return;
    });
});

qtyfuel.addEventListener("change", () => {
    let operation = "*";
    let gas = document.querySelector('input[name="fuel"]:checked');
    let salestax = Number(gas.dataset['cost'] * SALESTAX);
    let salesTaxSpan = document.getElementById('salestax');
    salesTaxSpan.textContent = qtyfuel.value == 0 ? "" : "(Includes 7% sales tax: $" + Number(salestax * qtyfuel.value).toFixed(2) + ")";
    let fuelPlusTax = Number(gas.dataset['cost']) + Number(salestax);
    calculateBill(Number(fuelPlusTax * Number(qtyfuel.value)), gas.dataset['display'], operation);
    setHiddenField("fuelsalestax", Number(salestax * Number(qtyfuel.value)).toFixed(2));
});

qtylabor.addEventListener("change", () => {
    let operation = "*";
    calculateBill(Number(qtylabor.dataset['cost'] * qtylabor.value), qtylabor.dataset['display'], operation);
});

quantities.forEach(quantity => {
    let choice = quantity.parentElement.previousElementSibling.firstElementChild.firstElementChild;
    quantity.addEventListener("change", () => {
        let operation = "*";
        console.log(`Number cost ${quantity.dataset['cost']} & Checkbox cost ${choice.dataset['cost']}`);
        calculateBill(Number(quantity.dataset['cost']) * quantity.value + Number(choice.dataset['cost']), quantity.dataset['display'], operation);
    });
});

otherService.addEventListener("input", () => {
    updateTotal();
});

function calculateBill(amt, display, operation) {
    console.log("Data value: " + amt);
    const amountDisplay = document.getElementById(display);
    let currentValue = amountDisplay.innerHTML
    if ( operation == "+" ) {
        amountDisplay.innerHTML = Number(Number(currentValue) + Number(amt)).toFixed(2);
    } else if ( operation == "-" ) {
        amountDisplay.innerHTML = Number(Number(currentValue) - Number(amt)).toFixed(2);
    } else if ( operation = "*" ) {
        amountDisplay.innerHTML = Number(amt).toFixed(2);
    }
    if ( amountDisplay.innerHTML == "0.00" ) amountDisplay.innerHTML = "";

    document.getElementById('environmentFee').textContent = Number(environmentalSum()).toFixed(2);

    updateTotal();
    
    if ( undefined === form[display]) {
        // create input hidden field on the form
        var hidden = document.createElement('input');
        hidden.setAttribute("type", "hidden");
        hidden.setAttribute("name", display);
        hidden.value = amountDisplay.innerHTML;
        form.appendChild(hidden);
    } else {
        form[display].value = amountDisplay.innerHTML;
    }
}

function environmentalSum() {
    var totalSum = sumAmounts();

    // remove Fuel amount and environmental fee amount
    totalSum -= Number(document.getElementById('amount-fuel').textContent);
    totalSum -= Number(document.getElementById('environmentFee').textContent);

    return Number(totalSum * 0.07);
}

// Dialog window for signature
const dialog = document.querySelector('dialog#sig');
const closeButton = document.querySelector("dialog .close");
const dialogOpen = document.getElementById("signature-small");
const clearCanvas = document.getElementById("clear");
const acceptCanvas = document.getElementById("accept");

// "Close" button closes the dialog
closeButton.addEventListener("click", () => {
  dialog.close();
});

dialogOpen.addEventListener("mousedown", () => {
    if (dialogOpen.hasChildNodes())
        removeOldSignatures();
});

function removeOldSignatures() {
    dialogOpen.removeChild(dialogOpen.children[0]);
}

dialogOpen.addEventListener("mouseup", () => {
    dialog.showModal();
});

clearCanvas.addEventListener("click", (e) => {
    signaturePad.clear();
    e.preventDefault();
})

acceptCanvas.addEventListener("click", (e) => {
    const signatureImage = document.createElement("img");
    let signatureData = signaturePad.toDataURL();
    signatureImage.setAttribute("src", signatureData);
    dialogOpen.appendChild(signatureImage);

    const signatureFile = document.getElementById("signatureFile");
    signatureFile.value = signatureData;
    signaturePad.clear();
    dialog.close();
    e.preventDefault();
})

// select location
locations.forEach( loc => {
    loc.addEventListener("change", () => {
        const authorization = document.querySelector('#authorizations');
        let id = authorization.value;

        const location = loc.value;
        const invoiceDate = document.getElementById('date').value.substring(5);
        const invoiceName = "INV" + document.getElementById('date').value.substring(5,2);
        document.getElementById('invoice-number').innerHTML = invoiceName + invoiceDate + location;
        setHiddenField('inv_number', document.getElementById('invoice-number').innerHTML);
    })
})
// user added location
const otherLocationText = document.getElementById("other-name");
const otherLocationRadio = document.getElementById("other");
otherLocationText.addEventListener('change', () => {
    otherLocationRadio.checked = false;
    var newValue = otherLocationText.value.toString();
    otherLocationRadio.value = newValue.toUpperCase();
});

// reset the invoice
function resetInvoice() {
    document.forms[0].reset();
    document.querySelectorAll('.amount').forEach(field => {field.innerHTML="";});
    document.querySelectorAll('input[type=hidden]').forEach(hinput => { hinput.value = "";});
    document.getElementById('signature-small').innerHTML = "";
    document.getElementById('invoice-number').innerHTML = "";;
    document.getElementById('totalSum').innerHTML = "";
    document.getElementById('date').value = setTodaysDate();
    document.getElementById('inv_number').value = "";
    document.getElementById('inv_total').value = "";
    document.getElementById('registration').value = "";
    document.querySelectorAll('input[type=number]').forEach((n) => {n.value = 0;});
    document.querySelectorAll('input[type=number]:not(#labor-hrs)').forEach((n) => {n.disabled = true;});
}

// set data costs
function setRtsCosts(rates) {
    document.getElementById('rtsfree').dataset['cost'] = rates.rts[0];
    document.getElementById('signoff').dataset['cost'] = rates.rts[1];
    document.getElementById('logbook').dataset['cost'] = rates.rts[2];
}

// set fuel costs
function setFuelCosts(rates) {
    document.getElementById('jeta').dataset['cost'] = rates.fuel[0];
    document.getElementById('jetaplus').dataset['cost'] = rates.fuel[1];
}

// set service costs on body
function setBodyCosts(rates) {
    document.getElementById('tires').dataset['cost'] = rates.tire;
    document.getElementById('tire-fee-label').innerHTML = rates.tire;
    document.getElementById('n2-service').dataset['cost'] = rates.n2;
    document.getElementById('n2-fee-label').innerHTML = rates.n2;
    document.getElementById('lav-service').dataset['cost'] = rates.lav;
    document.getElementById('lav-fee-label').innerHTML = rates.lav;
}

// set extra costs
function setExtraCosts(rates) {
    document.getElementById('access-fee').dataset['cost'] = rates.access;
    document.getElementById('access-fee-label').innerHTML = rates.access;
    document.getElementById('tks').dataset['cost'] = rates.tks;
    document.getElementById('tks-label').innerHTML = rates.tks;
    document.getElementById('wo-shipping-fee').dataset['cost'] = rates.woship;
    document.getElementById('wo-shipping-label').innerHTML = rates.woship;
}

// set engine oil costs
function setOilCosts(rates) {
    document.getElementById('oil-qt1').dataset['cost'] = rates.qt;
    document.getElementById('oil-qt2').dataset['cost'] = rates.qt;
    document.getElementById('oil-qt3').dataset['cost'] = rates.qt;
    document.getElementById('oil-apu-qt').dataset['cost'] = rates.qt;
}

function setVariableCosts(rates) {
    if ( largeCabin.checked ) {
        document.getElementById('callout').dataset['cost'] = rates.aog * 4;
        document.getElementById('labor-hrs').dataset['cost'] = rates.aog;
    } else {
        document.getElementById('callout').dataset['cost'] = rates.hrs * 4;
        document.getElementById('labor-hrs').dataset['cost'] = rates.hrs;
    }
    document.getElementById('o2-service').dataset['cost'] = rates.o2;
    document.getElementById('oil-engine1').dataset['cost'] = rates.oil;
    document.getElementById('oil-engine2').dataset['cost'] = rates.oil;
    document.getElementById('oil-engine3').dataset['cost'] = rates.oil;
    document.getElementById('oil-apu').dataset['cost'] = rates.oil;
}

function updateInvoice(rates) {
    // Used when Labor changes weekday/overtime/holiday
    setVariableCosts(rates);
    const variableElements = ['oil-engine1','oil-engine2','oil-engine3','oil-apu','o2-service'];
    variableElements.forEach(elm => {
        console.log(`Updating ${elm}`);
        elm = document.getElementById(elm);
        if ( elm.checked ) {
            let operation = "*";
            calculateBill(elm.dataset['cost'] , elm.dataset['display'], operation);
        }
    });
    updateTotal();
}

function updateLabor(rates) {
    setVariableCosts(rates);
    laborBase.forEach(base => {
        if( base.checked ) {
            const evt = new Event('change');
            base.dispatchEvent(evt);
        }
    });
    updateTotal();
}

function updateOrigin(rates) {
    country = document.forms[0].outOfCountry.value == "ON" ? "foreign" : "usa";
    setVariableCosts(rates);
    // if Callout is checked:
    if ( document.getElementById('callout').checked ) {
        const callout_amount = document.getElementById('amount-callout');
        if ( largeCabin.checked ) {
            callout_amount.textContent = Number(rates.aog * 4).toFixed(2);
        } else {
            callout_amount.textContent = Number(rates.hrs * 4).toFixed(2);
        }
        updateTotal();
    }
}

function sumAmounts() {
    var totalSum = 0.00;
    const amounts = document.querySelectorAll('.amount');
    amounts.forEach( charge => {
        totalSum += Number(charge.innerHTML);
    });
    return totalSum += Number(otherService.value);
}

function updateTotal() {
    var totalSum = sumAmounts();
  
    totalSum = totalSum.toFixed(2);
    let USDollar = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
    });
    document.getElementById('totalSum').innerHTML = `${USDollar.format(totalSum)}`;
    document.getElementById('inv_total').value = totalSum;
}

// Database stuff

function getData(){
  var ajax = new XMLHttpRequest();
  var formdata = new FormData();
  formdata.append("operation","getAuthorizations");
  formdata.append("f_type","request");
  ajax.addEventListener("load", completeHandlerSms, false);
  ajax.addEventListener("error", errorHandlerSms, false);
  ajax.addEventListener("abort", abortHandlerSms, false);
  ajax.open("POST", "../bamqbill/process/ajax.php");
  ajax.send(formdata);
}
function completeHandlerSms(event){
  console.log("RFQ Response: %s", event.target.responseText);
  createCustomerDropdown(event.target.responseText);
  resetInvoice();
}
function errorHandlerSms(event){
  console.log("Upload Failed: " + event.target.responseText);
}
function abortHandlerSms(event){
  console.log("Upload Aborted: " + event.target.responseText);
}

function createCustomerDropdown(data) {
  const dropdown = document.getElementById('authorizations');
  dropdown.innerHTML = "";
  const firstOption = document.createElement('option');
  firstOption.setAttribute("selected","");
  firstOption.innerHTML = "Please choose...";
  dropdown.appendChild(firstOption);
  data.forEach( (customer, idx) => {
    let option = document.createElement('option');
    option.value = customer.id;
    option.innerHTML = customer.registration;
    dropdown.appendChild(option);
    testData[customer.id] =
    {
      "registration": customer.registration,
      "customer": `${customer.contactname}\n${customer.companyname}\n${customer.address1}\n${customer.address2}`,
      "email": customer.email,
      "service": customer.servicereq,
      "signature": customer.authorized
    }
  });
}

// form submission

if ( form !== null ) {
  form.addEventListener('submit', function(e) {
    console.log("SUBMIT");
    if (validate(form)) {
        document.getElementById('sendbtn').classList.add('hidden');
        document.getElementById('sendingbtn').classList.remove('hidden');
        confirm();
    }
    // Prevent default posting of form
    e.preventDefault();
  });
}

function sendEmail(){
  var ajax = new XMLHttpRequest();
  var formdata = new FormData( document.querySelector("form") );
  formdata.append("operation","registerBillAndSend");
  formdata.append("f_type","request");
  ajax.addEventListener("load", completeHandler, false);
  ajax.addEventListener("error", errorHandler, false);
  ajax.addEventListener("abort", abortHandler, false);
  ajax.open("POST", "./process/ajax.php");
  ajax.send(formdata);
}
function completeHandler(event){
  thankyou();
  console.log("RFQ Response: %s", event.target.responseText);
  resetInvoice();
  document.getElementById('sendbtn').classList.remove('hidden');
  document.getElementById('sendingbtn').classList.add('hidden');
}
function errorHandler(event){
  console.log("Upload Failed: " + event.target.responseText);
}
function abortHandler(event){
  console.log("Upload Aborted: " + event.target.responseText);
}

function thankyou() {
    const dialogThanks = document.querySelector("dialog#thankyou");
    const dialogClose = document.querySelector('#txClose');
    document.getElementById('txInvoice').innerHTML = document.getElementById('invoice-number').innerHTML;
    dialogThanks.showModal();
    const closeButton = document.querySelector("#close-thankyou");
    closeButton.addEventListener("click", (event) => {
        dialogThanks.close();
        event.preventDefault();
    });
    dialogClose.addEventListener('click', () => {
        dialogThanks.close();
    });
    
    document.querySelector("form").reset();
}

function validate(form) {
    if (form.authorizations.value == "") { form.authorizations.focus(); alert("Please choose a tail number."); return false; }
    if (undefined === form['amount-labor'] || form['amount-labor'].value == "") { alert("Labor hours is zero!"); return false; }
    return true;
}

function confirm() {
    const confirmDialog = document.getElementById("confirm");
    confirmDialog.showModal();
    const cancelButton = confirmDialog.querySelector("#cancelBtn");
    cancelButton.addEventListener("click", () => {
        confirmDialog.close(); 
    });
    const confirmButton = confirmDialog.querySelector("#confirmBtn");
    confirmButton.addEventListener("click", () => {
        confirmDialog.close();
        sendEmail(); 
    });

}
