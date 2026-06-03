public inherited sharing class DebtDetailsWrapper {
    
    private Debt_Details__c source;

    public Id originalCreditorId;
    public Id currentCreditorId;
    public String originalCreditor;
    public String currentCreditor;
    public Decimal debtAmount;
    public Boolean includeInTheOpportunity;
    public String creditorName;
    public Id recordId;
    public Decimal payment;
    public String frequency;
    public Id opportunityId;
    public Id programPlanId;

    public DebtDetailsWrapper(Debt_Details__c debtDetailsInstance) {
        this.source = debtDetailsInstance;
        assignValuesFromSObject();
    }

    private void assignValuesFromSObject() {
        originalCreditorId = this.source.Original_Creditor__c;
        currentCreditorId = this.source.Current_Creditor__c;
        originalCreditor = this.source.Original_Creditor__r.Name;
        currentCreditor = this.source.Current_Creditor__r.Name;
        debtAmount = this.source.Debt_Amount__c;
        creditorName = this.source.Creditor_Name__c;
        recordId = this.source.Id;
        payment = this.source.Payment__c;
        frequency = this.source.Payment_Frequency__c;
        opportunityId = this.source.Opportunity__c;
        programPlanId = this.source.Program_Plan__c;
        includeInTheOpportunity = this.source.Opportunity__c != null ? true : false;
    }

    public static Debt_Details__c getDebtDetails(DebtDetailsWrapper debtWrap) {
        Debt_Details__c debtDetails = new Debt_Details__c();
        debtDetails.Creditor_Name__c = debtWrap.creditorName;
        debtDetails.Debt_Amount__c = debtWrap.debtAmount;
        debtDetails.Payment__c = debtWrap.payment;
        debtDetails.Payment_Frequency__c = debtWrap.frequency;
        debtDetails.Opportunity__c = debtWrap.opportunityId;
        debtDetails.Program_Plan__c = debtWrap.programPlanId;
        debtDetails.Id = debtWrap.recordId;
        debtDetails.Current_Creditor__c = debtWrap.currentCreditorId;
        return debtDetails;
    }
}