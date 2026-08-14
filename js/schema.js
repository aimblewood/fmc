/* Record-type registry for My Fleet — derived from Simon's Dynamics 365
 * entity/field workbook (CRM.xlsx, colour key):
 *   green = standard input · blue = pick-list · purple = link to another
 *   record · orange = calculated.
 * Additions beyond the workbook are marked ADDED (structural glue: links from
 * contracts/milestones to vehicles, an order status). Future add-ons (Leads,
 * Fines & Penalties, Accidents, Short Hire, Pool, Fuel, Allocations) are
 * listed in FUTURE below.
 */

const PICK = {
  fuelType: ["Petrol", "Diesel", "Diesel (non-RDE2)", "Hybrid", "Plug-in Hybrid", "Electric"],
  transmission: ["Manual", "Automatic"],
  bodyStyle: ["Hatchback", "Saloon", "Estate", "SUV", "Coupe", "MPV", "Panel Van", "Car-derived Van", "Pickup", "Other"],
  fundingMethod: ["Contract Hire", "Finance Lease", "Contract Purchase", "Hire Purchase", "Outright Purchase", "Salary Sacrifice", "PCP"],
  paymentProfile: ["3+33", "3+35", "6+35", "1+47", "3+45", "1+35", "Spread", "Other"],
  currency: ["GBP", "EUR", "USD"],
  vatType: ["Standard", "VAT Qualifying", "Margin", "Exempt"],
  term: ["12", "24", "36", "48", "60"],
  employeeStatus: ["Active", "On leave", "Left"],
  contactType: ["Driver", "Fleet contact", "Finance", "HR", "Director", "Other"],
  driverGrade: ["Standard", "Manager", "Senior Manager", "Director", "Pool"],
  addressType: ["Home", "Work", "Other"],
  relationshipType: ["Customer", "Prospect", "Supplier", "Partner", "Other"],
  industry: ["Construction", "Professional services", "Manufacturing", "Healthcare", "Retail", "Logistics", "Technology", "Utilities", "Charity", "Other"],
  orderStatus: ["Quote", "Proposal sent", "Ordered", "In build", "Delivered", "Lost"],
  yesNo: ["Yes", "No"]
};

const money = (key, label, extra = {}) => ({ key, label, type: "money", ...extra });
const num = (key, label, extra = {}) => ({ key, label, type: "number", ...extra });
const text = (key, label, extra = {}) => ({ key, label, type: "text", ...extra });
const date = (key, label, extra = {}) => ({ key, label, type: "date", ...extra });
const pick = (key, label, options, extra = {}) => ({ key, label, type: "pick", options, ...extra });
const lookup = (key, label, entity, extra = {}) => ({ key, label, type: "lookup", entity, ...extra });
const calc = (key, label, fn) => ({ key, label, type: "calc", fn });
const secret = (key, label) => ({ key, label, type: "secret" });

export const ENTITIES = {
  vehicles: {
    name: "Vehicles", singular: "Vehicle", icon: "car",
    titleField: "reg",
    subtitle: r => [r.make, r.model].filter(Boolean).join(" "),
    groups: [
      { label: "Identity", fields: [
        text("reg", "Registration", { required: true, upper: true }),
        text("chassis", "Chassis number (VIN)"),
        pick("make", "Make", ["Audi", "BMW", "Citroën", "Ford", "Hyundai", "Kia", "Mercedes-Benz", "MG", "Nissan", "Peugeot", "Polestar", "Renault", "Škoda", "Tesla", "Toyota", "Vauxhall", "Volkswagen", "Volvo", "Other"], { free: true }),
        text("model", "Model"),
        text("derivative", "Derivative"),
        date("regDate", "Date of registration"),
      ]},
      { label: "Specification", fields: [
        text("engineSize", "Engine size"),
        pick("fuelType", "Fuel type", PICK.fuelType),
        num("engineCc", "Engine cc"),
        num("doors", "Number of doors"),
        pick("bodyStyle", "Body style", PICK.bodyStyle, { free: true }),
        pick("transmission", "Transmission", PICK.transmission),
        num("co2", "CO2 emissions (g/km)"),
        money("p11d", "P11D value"),
        num("fuelConsumption", "Fuel consumption (mpg / mi-per-kWh)"),
        num("evRange", "EV range (miles)"),
        text("extColour", "Exterior colour"),
        text("intColour", "Interior colour"),
        text("standardItems", "Standard items", { long: true }),
        text("optionalExtras", "Optional extras", { long: true }),
      ]},
      { label: "Allocation & supply", fields: [
        lookup("driver", "Driver", "contacts"),
        money("driverContribution", "Driver contribution"),
        pick("territory", "Territory", ["North", "South", "East", "West", "Midlands", "Scotland", "Wales", "NI"], { free: true }),
        text("po", "PO number"),
        text("supplyingDealer", "Supplying dealer"),
        date("expectedDelivery", "Expected delivery date"),
        text("keyNumber", "Key number"),
      ]},
    ]
  },

  contracts: {
    name: "Contracts", singular: "Contract", icon: "doc",
    titleField: "funderRef",
    subtitle: r => r.fundingMethod || "",
    groups: [
      { label: "Agreement", fields: [
        text("funderRef", "Funder reference", { required: true }),
        text("funder", "Funder"),
        lookup("vehicle", "Vehicle", "vehicles", { added: true }),
        lookup("account", "Account", "accounts", { added: true }),
        pick("term", "Term (months)", PICK.term, { free: true }),
        pick("fundingMethod", "Funding method", PICK.fundingMethod),
        num("annualMileage", "Annual mileage"),
        pick("paymentProfile", "Payment profile", PICK.paymentProfile, { free: true }),
        pick("currency", "Currency", PICK.currency),
        date("startDate", "Start date", { added: true }),
        date("endDate", "End date", { added: true, alert: "Contract end" }),
      ]},
      { label: "Rentals & pricing", fields: [
        money("financeRental", "Finance rental (monthly)"),
        money("serviceRental", "Service rental (monthly)"),
        calc("totalRental", "Total rental", r => (+r.financeRental || 0) + (+r.serviceRental || 0)),
        calc("effectiveRental", "Effective rental", r => {
          const t = (+r.financeRental || 0) + (+r.serviceRental || 0);
          const months = +r.term || 0;
          const extra = (+r.initialPayment || 0) + (+r.finalPayment || 0);
          return months ? t + extra / months : t;
        }),
        num("excessMileage", "Excess mileage (ppm)"),
        money("otr", "On the road price"),
        pick("vatType", "VAT type", PICK.vatType),
        money("initialPayment", "Initial payment"),
        money("finalPayment", "Final payment"),
      ]},
      { label: "Fees & margin", fields: [
        money("commissions", "Commissions"),
        money("setupFee", "Setup fee"),
        money("managementFee", "Management fee"),
        calc("managementFeeProfit", "Management fee profit", r => (+r.managementFee || 0) - (+r.costs || 0)),
        money("otherRevenue", "Other revenue"),
        money("costs", "Costs"),
        calc("totalProfit", "Total profit", r =>
          (+r.commissions || 0) + (+r.setupFee || 0) + (+r.managementFee || 0) + (+r.otherRevenue || 0) - (+r.costs || 0)),
      ]},
    ]
  },

  contacts: {
    name: "Contacts", singular: "Contact", icon: "person",
    titleField: "surname",
    title: r => [r.firstName, r.surname].filter(Boolean).join(" ") || r.preferredName || "(unnamed)",
    subtitle: r => r.jobTitle || r.contactType || "",
    groups: [
      { label: "Person", fields: [
        text("firstName", "First name", { required: true }),
        text("middleName", "Middle name"),
        text("surname", "Surname", { required: true }),
        text("preferredName", "Alternative / preferred name"),
        pick("employeeStatus", "Employee status", PICK.employeeStatus),
        text("jobTitle", "Job title"),
        pick("contactType", "Contact type", PICK.contactType),
        pick("driverGrade", "Driver grade", PICK.driverGrade),
        pick("fuelBenefit", "Fuel benefit", PICK.yesNo),
        text("employeeCode", "Employee code"),
        date("dob", "Date of birth"),
        lookup("account", "Account", "accounts", { added: true }),
      ]},
      { label: "Contact details", fields: [
        text("workEmail", "Work email address", { email: true }),
        text("personalEmail", "Personal email address", { email: true }),
        text("workMobile", "Work mobile"),
        text("personalMobile", "Personal mobile"),
        text("workLandline", "Work landline"),
        text("homeLandline", "Home landline"),
      ]},
      { label: "Address", fields: [
        text("address1", "Address line 1"),
        text("address2", "Address line 2"),
        text("address3", "Address line 3"),
        text("address4", "Address line 4"),
        text("town", "Town"),
        text("county", "County"),
        text("postcode", "Postcode", { upper: true }),
        text("country", "Country"),
        pick("addressType", "Address type", PICK.addressType),
      ]},
    ]
  },

  accounts: {
    name: "Accounts", singular: "Account", icon: "building",
    titleField: "accountName",
    subtitle: r => r.industry || "",
    groups: [
      { label: "Organisation", fields: [
        text("accountName", "Account name", { required: true }),
        lookup("primaryContact", "Primary contact", "contacts"),
        pick("relationshipType", "Relationship type", PICK.relationshipType),
        text("mainPhone", "Main phone"),
        text("website", "Website"),
        num("fleetSize", "Fleet size"),
        text("registeredNumber", "Registered number"),
        text("vatNumber", "VAT number"),
        pick("industry", "Industry", PICK.industry, { free: true }),
        num("employees", "Number of employees"),
        num("yearEstablished", "Year established"),
      ]},
      { label: "Services & fees", fields: [
        money("setupFee", "Setup fee"),
        money("managementFee", "Management fee"),
        pick("accidentManagement", "Accident management", PICK.yesNo),
        pick("fuelCard", "Fuel card", PICK.yesNo),
        lookup("insurer", "Insurer", "insurance"),
        pick("updateMid", "Update MID", PICK.yesNo),
      ]},
      { label: "Banking", fields: [
        text("bankName", "Bank name"),
        text("bankAccountName", "Bank account name"),
        text("sortCode", "Sort code"),
        text("accountNumber", "Account number"),
      ]},
      { label: "Address", fields: [
        text("address1", "Address line 1"),
        text("address2", "Address line 2"),
        text("address3", "Address line 3"),
        text("address4", "Address line 4"),
        text("town", "Town"),
        text("county", "County"),
        text("postcode", "Postcode", { upper: true }),
        text("country", "Country"),
      ]},
    ]
  },

  milestones: {
    name: "Key Milestones", singular: "Milestone record", icon: "flag",
    titleField: "vehicle",
    title: (r, resolve) => resolve ? resolve("vehicles", r.vehicle) || "(no vehicle)" : (r.vehicle || "(no vehicle)"),
    subtitle: r => r.deliveryDate ? "Delivered " + r.deliveryDate : (r.expectedDelivery ? "Expected " + r.expectedDelivery : ""),
    groups: [
      { label: "Vehicle", fields: [
        lookup("vehicle", "Vehicle", "vehicles", { added: true, required: true }),
        date("createdOn", "Created on"),
      ]},
      { label: "Order to delivery", fields: [
        date("orderReceived", "Order received"),
        date("proposalSent", "Proposal sent"),
        date("orderToDealer", "Order to dealer"),
        date("orderConfirmed", "Order confirmed"),
        date("buildDateConfirmed", "Build date confirmed"),
        date("contractSent", "Contract sent"),
        date("contractsSigned", "Contracts signed"),
        date("expectedDelivery", "Expected delivery date"),
        date("deliveryDate", "Delivery date"),
        date("registrationDate", "Date of registration"),
      ]},
      { label: "In life & end of life", fields: [
        date("sentForPayout", "Sent for payout"),
        date("paidOut", "Paid out"),
        date("motDue", "MOT due date", { alert: "MOT" }),
        date("renewalDate", "Renewal date", { alert: "Renewal" }),
        date("dehireDate", "Dehire date"),
      ]},
    ]
  },

  insurance: {
    name: "Insurance", singular: "Insurance policy", icon: "shield",
    titleField: "insurer",
    subtitle: r => r.policyNumber ? "Policy " + r.policyNumber : "",
    groups: [
      { label: "Policy", fields: [
        text("insurer", "Insurer", { required: true }),
        text("policyNumber", "Policy number"),
        date("policyStart", "Policy start date"),
        date("policyExpiry", "Policy expiry date", { alert: "Insurance expiry" }),
        money("insuranceExcess", "Insurance excess"),
        money("glassExcess", "Glass excess"),
      ]},
      { label: "Motor Insurance Database", fields: [
        text("midWebsite", "MID website"),
        text("midUser1", "MID ID user 1"),
        text("midUser2", "MID ID user 2"),
        secret("midPassword", "Password"),
        secret("midPassPhrase", "MID pass phrase"),
      ]},
    ]
  },

  orders: {
    name: "Orders & Quotes", singular: "Order / quote", icon: "cart",
    titleField: "make",
    title: r => [r.make, r.model].filter(Boolean).join(" ") || "(unspecified vehicle)",
    subtitle: r => r.status || "",
    groups: [
      { label: "Status", fields: [
        pick("status", "Status", PICK.orderStatus, { added: true, required: true }),
        lookup("account", "Account", "accounts"),
        lookup("driver", "Driver", "contacts"),
      ]},
      { label: "Vehicle", fields: [
        pick("make", "Make", ["Audi", "BMW", "Citroën", "Ford", "Hyundai", "Kia", "Mercedes-Benz", "MG", "Nissan", "Peugeot", "Polestar", "Renault", "Škoda", "Tesla", "Toyota", "Vauxhall", "Volkswagen", "Volvo", "Other"], { free: true }),
        text("model", "Model"),
        text("derivative", "Derivative"),
        text("engineSize", "Engine size"),
        pick("fuelType", "Fuel type", PICK.fuelType),
        num("engineCc", "Engine cc"),
        num("doors", "Number of doors"),
        pick("bodyStyle", "Body style", PICK.bodyStyle, { free: true }),
        pick("transmission", "Transmission", PICK.transmission),
        num("co2", "CO2 emissions (g/km)"),
        money("p11d", "P11D value"),
      ]},
      { label: "Funding", fields: [
        text("funder", "Funder"),
        pick("term", "Term (months)", PICK.term, { free: true }),
        pick("fundingMethod", "Funding method", PICK.fundingMethod),
        num("annualMileage", "Annual mileage"),
        pick("paymentProfile", "Payment profile", PICK.paymentProfile, { free: true }),
        pick("currency", "Currency", PICK.currency),
        money("financeRental", "Finance rental (monthly)"),
        money("serviceRental", "Service rental (monthly)"),
        calc("totalRental", "Total rental", r => (+r.financeRental || 0) + (+r.serviceRental || 0)),
        calc("effectiveRental", "Effective rental", r => {
          const t = (+r.financeRental || 0) + (+r.serviceRental || 0);
          const months = +r.term || 0;
          const extra = (+r.initialPayment || 0) + (+r.finalPayment || 0);
          return months ? t + extra / months : t;
        }),
        num("excessMileage", "Excess mileage (ppm)"),
        money("otr", "On the road price"),
        pick("vatType", "VAT type", PICK.vatType),
        money("initialPayment", "Initial payment"),
        money("finalPayment", "Final payment"),
        money("driverContribution", "Driver contribution"),
      ]},
      { label: "Commercials", fields: [
        money("commissions", "Commissions"),
        money("setupFee", "Setup fee"),
        money("managementFee", "Management fee"),
        calc("managementFeeProfit", "Management fee profit", r => (+r.managementFee || 0) - (+r.costs || 0)),
        money("otherRevenue", "Other revenue"),
        money("costs", "Costs"),
        calc("totalProfit", "Total profit", r =>
          (+r.commissions || 0) + (+r.setupFee || 0) + (+r.managementFee || 0) + (+r.otherRevenue || 0) - (+r.costs || 0)),
        date("expectedDelivery", "Expected delivery date"),
        text("supplyingDealer", "Supplying dealer"),
      ]},
    ]
  }
};

export const FUTURE = ["Leads", "Fines & Penalties", "Accidents", "Short Hire", "Pool", "Fuel", "Allocations"];

/* flatten fields */
export function fieldsOf(entityKey) {
  return ENTITIES[entityKey].groups.flatMap(g => g.fields);
}
export function inputFieldsOf(entityKey) {
  return fieldsOf(entityKey).filter(f => f.type !== "calc");
}

/* list-view column sets (kept tight; detail view shows everything) */
export const LIST_COLUMNS = {
  vehicles: ["reg", "make", "model", "fuelType", "co2", "p11d", "driver"],
  contracts: ["funderRef", "vehicle", "funder", "fundingMethod", "term", "totalRental", "endDate"],
  contacts: ["firstName", "surname", "jobTitle", "contactType", "workEmail", "workMobile"],
  accounts: ["accountName", "relationshipType", "industry", "fleetSize", "mainPhone"],
  milestones: ["vehicle", "orderReceived", "expectedDelivery", "deliveryDate", "motDue", "renewalDate"],
  insurance: ["insurer", "policyNumber", "policyStart", "policyExpiry", "insuranceExcess"],
  orders: ["status", "make", "model", "fundingMethod", "totalRental", "expectedDelivery"]
};

/* CSV import synonym map (normalised header -> field key), per entity */
export const CSV_SYNONYMS = {
  vehicles: {
    reg: "reg", registration: "reg", vrm: "reg", regno: "reg", registrationnumber: "reg", plate: "reg",
    vin: "chassis", chassis: "chassis", chassisnumber: "chassis",
    make: "make", manufacturer: "make", marque: "make",
    model: "model", derivative: "derivative", trim: "derivative", variant: "derivative",
    fuel: "fuelType", fueltype: "fuelType",
    co2: "co2", co2emissions: "co2", co2gkm: "co2", emissions: "co2",
    p11d: "p11d", p11dvalue: "p11d", listprice: "p11d",
    enginesize: "engineSize", enginecc: "engineCc", cc: "engineCc",
    doors: "doors", numberofdoors: "doors",
    bodystyle: "bodyStyle", body: "bodyStyle", transmission: "transmission", gearbox: "transmission",
    dateofregistration: "regDate", regdate: "regDate", registered: "regDate", firstregistered: "regDate",
    colour: "extColour", color: "extColour", exteriorcolour: "extColour", interiorcolour: "intColour",
    mpg: "fuelConsumption", fuelconsumption: "fuelConsumption", evrange: "evRange", range: "evRange",
    driver: "driver", drivername: "driver", assignedto: "driver", keeper: "driver",
    dealer: "supplyingDealer", supplyingdealer: "supplyingDealer",
    po: "po", ponumber: "po", purchaseorder: "po",
    expecteddelivery: "expectedDelivery", deliverydate: "expectedDelivery",
    keynumber: "keyNumber", territory: "territory", drivercontribution: "driverContribution"
  }
};
