public inherited sharing class ProductAndPriceBookData {

    public static PricebookEntry getPriceBookEntryId(String priceBookName, String productCode) {
        PricebookEntry priceBookEntryRecord;
        List<PricebookEntry> priceBookEntryList = [SELECT Id, Product2Id, UnitPrice FROM PricebookEntry WHERE Pricebook2.Name = :priceBookName AND Product2.ProductCode = :productCode AND IsActive = true];
        if (priceBookEntryList != null && !priceBookEntryList.isEmpty()) {
            priceBookEntryRecord = priceBookEntryList[0];
        }
        return priceBookEntryRecord;
    }
}