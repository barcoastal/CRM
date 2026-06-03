public inherited sharing class ProductAndPriceBookUtil {

    public static final String PRICE_BOOK_SAS = 'SAS Price Book';
    public static final String PRODUCT_CITADEL_FEE = FeeUtil.PRODUCT_CITADEL_FEE;
    public static final String PRODUCT_VICTORY_FEE = FeeUtil.PRODUCT_VICTORY_FEE;
    public static final Integer PRODUCT_QUANTITY = 1;

    public static PricebookEntry getPriceBookEntry(String priceBookName, String productCode) {
        PricebookEntry priceBookEntryRecord = ProductAndPriceBookData.getPriceBookEntryId(priceBookName, productCode);
        return priceBookEntryRecord;
    }
}