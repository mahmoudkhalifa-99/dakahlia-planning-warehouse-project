/**
 * نظام إدارة نقل الخامات - الإصدار المطور بالكامل
 * ربط واجهة React بجدول بيانات Google Sheets (رؤوس عربية)
 * يدعم: نقل الخامات، الإفراجات، رصيد المصانع، والبيانات الأساسية
 */

const SS = SpreadsheetApp.getActiveSpreadsheet();

// أسماء الصفحات (الشيتات) بالعربي كما هي في النظام
const SHEETS = {
  TRANSPORTS_SOY: "نقل_صويا",
  TRANSPORTS_MAIZE: "نقل_ذرة",
  TRANSPORTS_MEAL: "نقل_كسب",
  PRODUCTION: "بيان_الإنتاج",
  RELEASES_SOY: "إفراجات_صويا",
  RELEASES_MAIZE: "إفراجات_ذرة",
  RELEASES_MEAL: "إفراجات_كسب",
  FACTORY_BALANCES: "رصيد_المصانع",
  MASTER_DATA: "البيانات_الأساسية",
  USERS: "المستخدمين"
};

/**
 * وظيفة تهيئة الجداول (قم بتشغيلها مرة واحدة عند إعداد المشروع)
 */
function initialSetup() {
  Object.values(SHEETS).forEach(name => {
    if (!SS.getSheetByName(name)) {
      const sheet = SS.insertSheet(name);
      if (name.includes("نقل") || name === SHEETS.PRODUCTION) {
        sheet.appendRow(["المسلسل", "التاريخ", "الحالة", "رقم البيان", "كود العميل", "اسم العميل", "رقم أمر التوريد", "كود الصنف", "اسم الصنف", "الكمية صب", "الكمية معبأ", "نوع المنصرف", "الوردية", "طريقة النقل", "إسم مقاول النقل", "نوع السيارة", "رقم السيارة", "اسم السائق", "عنوان العميل", "رقم الشهادة", "القطع", "15 على الطن", "موظف التشغيل", "أمين المخزن", "المورد", "اسم المركب", "عقد جديد", "نوع المبيعات", "مقاول النقل", "نوع الصنف", "مكان التحميل", "اللودر", "الميناء", "رقم الفاتورة"]);
      } else if (name.includes("إفراجات")) {
        sheet.appendRow(["المسلسل", "رقم الإفراج", "رقم أمر التوريد", "التاريخ", "كود الصنف", "كود العميل", "الموقع", "المورد", "المينا", "اسم المركب", "مكان التحميل", "الكمية", "رقم الشهادة", "رقم البوليصة", "نوع البضاعة", "ملاحظات"]);
      } else if (name === "رصيد_المصانع") {
        sheet.appendRow(["اسم الموقع", "نوع البضاعة", "رصيد البداية", "الصرف اليدوي"]);
      } else if (name === "المستخدمين") {
        sheet.appendRow(["الاسم", "PIN", "الصلاحية", "الأصناف المسموحة"]);
        sheet.appendRow(["مدير النظام", "1234", "admin", "الكل"]);
      } else if (name === "البيانات_الأساسية") {
        sheet.appendRow(["التصنيف", "القيم"]);
      }
    }
  });
}

/**
 * استقبال طلبات GET لجلب البيانات
 */
function doGet(e) {
  const action = e.parameter.action;
  try {
    if (action === "getAllData") {
      return createResponse({
        transports: getTransportsData(),
        releases: getReleasesData(),
        factoryBalances: getDataFromSheet(SHEETS.FACTORY_BALANCES, getMap("factoryBalance")),
        masterData: getMasterData()
      });
    } else if (action === "getTransports") {
      return createResponse(getTransportsData());
    } else if (action === "getReleases") {
      return createResponse(getReleasesData());
    } else if (action === "getBalances") {
      return createResponse(getDataFromSheet(SHEETS.FACTORY_BALANCES, getMap("factoryBalance")));
    } else if (action === "getMaster") {
      return createResponse(getMasterData());
    }
  } catch (err) { 
    return createResponse({ error: err.message }, 500); 
  }
}

function getTransportsData() {
  const map = getMap("record");
  return [
    ...getDataFromSheet(SHEETS.TRANSPORTS_SOY, map).map(r => ({...r, goodsType: "صويا", weight: (Number(r.quantityBulk || 0) + Number(r.quantityPacked || 0)) || Number(r.weight || 0)})), 
    ...getDataFromSheet(SHEETS.TRANSPORTS_MAIZE, map).map(r => ({...r, goodsType: "ذرة", weight: (Number(r.quantityBulk || 0) + Number(r.quantityPacked || 0)) || Number(r.weight || 0)})),
    ...getDataFromSheet(SHEETS.TRANSPORTS_MEAL, map).map(r => ({...r, goodsType: "كسب", weight: (Number(r.quantityBulk || 0) + Number(r.quantityPacked || 0)) || Number(r.weight || 0)})),
    ...getDataFromSheet(SHEETS.PRODUCTION, map).map(r => ({...r, goodsType: "إنتاج", weight: (Number(r.quantityBulk || 0) + Number(r.quantityPacked || 0)) || Number(r.weight || 0)}))
  ];
}

function getReleasesData() {
  const map = getMap("release");
  return [
    ...getDataFromSheet(SHEETS.RELEASES_SOY, map).map(r => ({...r, goodsType: "صويا"})), 
    ...getDataFromSheet(SHEETS.RELEASES_MAIZE, map).map(r => ({...r, goodsType: "ذرة"})),
    ...getDataFromSheet(SHEETS.RELEASES_MEAL, map).map(r => ({...r, goodsType: "كسب"}))
  ];
}

/**
 * استقبال طلبات POST للإضافة، التعديل، والحذف
 */
function doPost(e) {
  try {
    const postData = JSON.parse(e.postData.contents);
    const action = postData.action;
    
    if (action === "addRecord") saveItem(postData.record, getMap("record"));
    else if (action === "updateRecord") updateItem(postData.record, getMap("record"), "المسلسل");
    else if (action === "deleteRecord") deleteItem(postData.autoId, postData.goodsType, "record", "المسلسل");
    else if (action === "saveMasterData") saveMasterConfig(postData.data);
    else if (action === "addReleasesBulk") addReleasesBulk(postData.header, postData.distributions);
    else if (action === "updateRelease") updateItem(postData.release, getMap("release"), "المسلسل");
    else if (action === "deleteRelease") deleteItem(postData.id, postData.goodsType, "release", "المسلسل");
    else if (action === "updateFactoryBalance") updateFactoryBalance(postData.balance);

    return createResponse({ success: true });
  } catch (err) { 
    return createResponse({ error: err.message }, 500); 
  }
}

/**
 * خريطة الموازنة بين أسماء الحقول في التطبيق ورؤوس الأعمدة في الشيت
 */
function getMap(type) {
  if (type === "record") {
    return {
      autoId: "المسلسل", 
      date: "التاريخ", 
      status: "الحالة", 
      statementNo: "رقم البيان", 
      customerCode: "كود العميل",
      customerName: "اسم العميل", 
      orderNo: "رقم أمر التوريد", 
      itemCode: "كود الصنف", 
      itemName: "اسم الصنف", 
      quantityBulk: "الكمية صب", 
      quantityPacked: "الكمية معبأ", 
      weight: "الوزن الصافي",
      unloadingSite: "موقع التعتيق",
      notes: "ملاحظات",
      expenditureType: "نوع المنصرف", 
      shift: "الوردية", 
      transportMethod: "طريقة النقل", 
      contractorName: "إسم مقاول النقل", 
      carType: "نوع السيارة", 
      carNumber: "رقم السيارة", 
      driverName: "اسم السائق", 
      customerAddress: "عنوان العميل", 
      certificateNo: "رقم الشهادة", 
      pieces: "القطع", 
      fifteenPerTon: "15 على الطن", 
      operationEmployee: "موظف التشغيل", 
      warehouseKeeper: "أمين المخزن", 
      supplier: "المورد", 
      shipName: "اسم المركب", 
      newContract: "عقد جديد", 
      salesType: "نوع المبيعات", 
      transportContractor: "مقاول النقل", 
      itemType: "نوع الصنف", 
      loadingSite: "مكان التحميل", 
      loader: "اللودر", 
      port: "الميناء", 
      invoiceNo: "رقم الفاتورة"
    };
  } else if (type === "release") {
    return {
      id: "المسلسل", releaseNo: "رقم الإفراج", orderNo: "رقم أمر التوريد", date: "التاريخ",
      itemCode: "كود الصنف", customerCode: "كود العميل", siteName: "الموقع", supplier: "المورد",
      port: "المينا", shipName: "اسم المركب", loadingSite: "مكان التحميل", totalQuantity: "الكمية",
      certificateNo: "رقم الشهادة", waybillNo: "رقم البوليصة", goodsType: "نوع البضاعة", notes: "ملاحظات"
    };
  } else if (type === "factoryBalance") {
    return {
      factoryName: "اسم الموقع", 
      goodsType: "نوع البضاعة", 
      openingBalance: "رصيد البداية", 
      manualConsumption: "الصرف اليدوي",
      inProgress: "قيد التحميل",
      driversLoading: "سائقين قيد التحميل",
      driversOnRoad: "سائقين بالطريق"
    };
  }
}

function createResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

const REV_MAPS = {};

function getDataFromSheet(name, map) {
  const sheet = SS.getSheetByName(name);
  if (!sheet) return [];
  const vals = sheet.getDataRange().getValues();
  if (vals.length <= 1) return [];
  
  const headers = vals[0];
  // Cache the reverse map to avoid redundant compute
  const mapKey = JSON.stringify(map);
  if (!REV_MAPS[mapKey]) {
    REV_MAPS[mapKey] = Object.entries(map).reduce((a, [k, v]) => (a[v] = k, a), {});
  }
  const revMap = REV_MAPS[mapKey];
  
  const result = [];
  const timeZone = SS.getSpreadsheetTimeZone();
  for(let i = 1; i < vals.length; i++) {
    const row = vals[i];
    let obj = {};
    headers.forEach((h, j) => { 
      if (revMap[h]) {
        let val = row[j];
        if (val instanceof Date) {
          val = Utilities.formatDate(val, timeZone, "yyyy-MM-dd");
        }
        obj[revMap[h]] = val; 
      }
    });
    result.push(obj);
  }
  return result;
}

function saveItem(item, map) {
  let sheetName = "";
  const type = String(item.goodsType || "");
  if (type.includes("إنتاج") || type.includes("منتج")) sheetName = SHEETS.PRODUCTION;
  else if (type.includes("صويا")) sheetName = SHEETS.TRANSPORTS_SOY;
  else if (type.includes("كسب")) sheetName = SHEETS.TRANSPORTS_MEAL;
  else sheetName = SHEETS.TRANSPORTS_MAIZE;
  
  const sheet = SS.getSheetByName(sheetName);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  sheet.appendRow(headers.map(h => {
    const key = Object.keys(map).find(k => map[k] === h);
    return item[key] !== undefined ? item[key] : "";
  }));
}

function updateItem(item, map, idCol) {
  const type = String(item.goodsType || "");
  const isSoy = type.includes("صويا");
  const isMeal = type.includes("كسب");
  const isProduction = type.includes("إنتاج") || type.includes("منتج");
  const isRelease = map["id"] ? true : false;
  let sheetName = "";
  
  if (isRelease) {
    if (isSoy) sheetName = SHEETS.RELEASES_SOY;
    else if (isMeal) sheetName = SHEETS.RELEASES_MEAL;
    else sheetName = SHEETS.RELEASES_MAIZE;
  } else {
    if (isProduction) sheetName = SHEETS.PRODUCTION;
    else if (isSoy) sheetName = SHEETS.TRANSPORTS_SOY;
    else if (isMeal) sheetName = SHEETS.TRANSPORTS_MEAL;
    else sheetName = SHEETS.TRANSPORTS_MAIZE;
  }
  
  const sheet = SS.getSheetByName(sheetName);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idIdx = headers.indexOf(idCol);
  const idValue = isRelease ? item.id : item.autoId;
  
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idIdx]) === String(idValue)) {
      const row = headers.map(h => {
        const key = Object.keys(map).find(k => map[k] === h);
        return item[key] !== undefined ? item[key] : data[i][headers.indexOf(h)];
      });
      sheet.getRange(i + 1, 1, 1, headers.length).setValues([row]);
      return;
    }
  }
}

function updateFactoryBalance(item) {
  const sheet = SS.getSheetByName(SHEETS.FACTORY_BALANCES);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const siteIdx = headers.indexOf("اسم الموقع");
  const goodsIdx = headers.indexOf("نوع البضاعة");
  const map = getMap("factoryBalance");

  let found = false;
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][siteIdx]).trim() === String(item.factoryName).trim() && 
        String(data[i][goodsIdx]).trim() === String(item.goodsType).trim()) {
      const row = headers.map(h => {
        const key = Object.keys(map).find(k => map[k] === h);
        return item[key] !== undefined ? item[key] : data[i][headers.indexOf(h)];
      });
      sheet.getRange(i + 1, 1, 1, headers.length).setValues([row]);
      found = true;
      break;
    }
  }
  
  if (!found) {
    sheet.appendRow(headers.map(h => {
      const key = Object.keys(map).find(k => map[k] === h);
      return item[key] || "";
    }));
  }
}

function deleteItem(id, goodsType, type, idCol) {
  const typeStr = String(goodsType || "");
  const isSoy = typeStr.includes("صويا");
  const isMeal = typeStr.includes("كسب");
  const isProduction = typeStr.includes("إنتاج") || typeStr.includes("منتج");
  let sheetName = "";
  
  if (type === "record") {
    if (isProduction) sheetName = SHEETS.PRODUCTION;
    else if (isSoy) sheetName = SHEETS.TRANSPORTS_SOY;
    else if (isMeal) sheetName = SHEETS.TRANSPORTS_MEAL;
    else sheetName = SHEETS.TRANSPORTS_MAIZE;
  } else {
    if (isSoy) sheetName = SHEETS.RELEASES_SOY;
    else if (isMeal) sheetName = SHEETS.RELEASES_MEAL;
    else sheetName = SHEETS.RELEASES_MAIZE;
  }
  
  const sheet = SS.getSheetByName(sheetName);
  const data = sheet.getDataRange().getValues();
  const idIdx = data[0].indexOf(idCol);
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idIdx]) === String(id)) { sheet.deleteRow(i + 1); return; }
  }
}

function saveMasterConfig(data) {
  const mSheet = SS.getSheetByName(SHEETS.MASTER_DATA);
  mSheet.clear().appendRow(["التصنيف", "القيم"]);
  Object.keys(data).forEach(k => { 
    if (k !== "users") mSheet.appendRow([k, JSON.stringify(data[k])]); 
  });
  
  const uSheet = SS.getSheetByName(SHEETS.USERS);
  uSheet.clear().appendRow(["الاسم", "PIN", "الصلاحية", "الأصناف المسموحة"]);
  if (data.users) {
    data.users.forEach(u => {
      uSheet.appendRow([u.name, u.pin, u.role, u.allowedMaterials]);
    });
  }
}

function getMasterData() {
  const mSheet = SS.getSheetByName(SHEETS.MASTER_DATA);
  const mData = mSheet.getDataRange().getValues();
  let master = { drivers: [], cars: [], loadingSites: [], unloadingSites: [], goodsTypes: [], orderNumbers: [], contractors: [], users: [], items: [] };
  
  mData.slice(1).forEach(r => { 
    try { 
      master[r[0]] = JSON.parse(r[1]); 
    } catch (e) {} 
  });
  
  const uSheet = SS.getSheetByName(SHEETS.USERS);
  const uData = uSheet.getDataRange().getValues();
  if (uData.length > 1) {
    master.users = uData.slice(1).map(r => ({ name: r[0], pin: r[1], role: r[2], allowedMaterials: r[3] }));
  }
  return master;
}

function addReleasesBulk(header, distributions) {
  distributions.forEach(dist => {
    const isSoy = String(header.goodsType).includes("صويا");
    const isMeal = String(header.goodsType).includes("كسب");
    let sheetName = "";
    if (isSoy) sheetName = SHEETS.RELEASES_SOY;
    else if (isMeal) sheetName = SHEETS.RELEASES_MEAL;
    else sheetName = SHEETS.RELEASES_MAIZE;
    
    const sheet = SS.getSheetByName(sheetName);
    const rec = {
      id: "REL-" + Math.floor(1000 + Math.random() * 9000), 
      releaseNo: header.releaseNo, 
      orderNo: header.orderNo,
      date: header.date, 
      itemCode: header.itemCode || "", 
      customerCode: dist.customerCode || "", 
      siteName: dist.siteName, 
      supplier: header.supplier || "",
      port: header.port || "",
      shipName: header.shipName || "",
      loadingSite: header.loadingSite || "",
      certificateNo: header.certificateNo || "",
      waybillNo: header.waybillNo || "",
      goodsType: header.goodsType, 
      totalQuantity: dist.quantity, 
      notes: header.notes || ""
    };
    const map = getMap("release");
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    sheet.appendRow(headers.map(h => {
      const key = Object.keys(map).find(k => map[k] === h);
      return rec[key] || "";
    }));
  });
}
