public inherited sharing class DebtDetailUtil {
    private static final Schema.DescribeSObjectResult DEBT_DETAIL_DESCRIBE = Schema.SObjectType.Debt_Details__c;
    public static final String STATUS_PARTIALLY_GRADUATED = 'Partially Graduated';
    public static final String STATUS_FULLY_GRADUATED     = 'Fully Graduated';
    public static final String CREDITOR_CATEGORY_VLP       = 'Victory Legal Plan';
    public static final String CREDITOR_CATEGORY_CITADEL   = 'Citadel';

    public static String getSObjectName() {
        return DEBT_DETAIL_DESCRIBE.getName();
    }
}