public inherited sharing class PaymentCalculatorSettings {

    private Payment_Calculator_Settings__c source {
        get {
            if (null == source) {
                source = getInstance();
            }
            return source;
        }
        set;
    }

    public Decimal serviceFee;
    public Decimal minSavingsCollectionPercentMonthly;
    public Decimal minSavingsCollectionPercentBiMonthly;
    public Decimal minSavingsCollectionPercentWeekly;

    public PaymentCalculatorSettings() {
        this.source = getInstance();
        this.serviceFee = this.source.Service_Fee__c;
        this.minSavingsCollectionPercentMonthly = this.source.Min_Savings_Collection_Percent_Monthly__c;
        this.minSavingsCollectionPercentBiMonthly = this.source.Min_Savings_Collection_Percent_BiMonthly__c;
        this.minSavingsCollectionPercentWeekly = this.source.Min_Savings_Collection_Percent_Weekly__c;
    }

    private Payment_Calculator_Settings__c getInstance() {
        return Payment_Calculator_Settings__c.getInstance();
    }
}