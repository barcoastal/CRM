public inherited sharing class SettlementWrapper {
    
    public Id recordId { get; set; }
    public String settlementExternalProcId { get; set; }
    public Date settlementDate { get; set; }
    public Decimal settlementAmount { get; set; }
    public String settlementStatus { get; set; }
    public String payeeId { get; set; }
    public Id clientSFId { get; set; }
    public String clientExternalProcId { get; set; }
    public String debitScheduleId { get; set; }

    public SettlementWrapper() {}

    public SettlementWrapper(Settlement__c settlementRecord) {
        this.recordId = settlementRecord.Id;
        this.settlementExternalProcId = settlementRecord.External_SAS_Id__c;
        this.settlementDate = settlementRecord.Settlement_Date__c;
        this.settlementAmount = settlementRecord.SettlementAmount__c;
        this.settlementStatus = settlementRecord.Settlement_Status__c;
        this.payeeId = settlementRecord.Offer__r.Debt_Details__r.Current_Creditor__r.External_SAS_Id__c;
        this.clientSFId = settlementRecord.Client_Account__c;
        this.clientExternalProcId = settlementRecord.Client_Account__r.External_SAS_Id__c;
    }

    public static Map<String, String> fieldNameLabelMap = new Map<String, String> {
        'recordId' => 'Settlement Id',
        'payeeId' => 'Payee Id',
        'settlementAmount' => 'Settlement Amount'
    };

    public Integer paymentNo;
    public Decimal amountToCreditor;
    public String paymentMethod;
    public Decimal paymentMethodAmount;
    public Decimal totalSettlementAmount;
    public Decimal settlementRunningBalance;
    public String settlementSyncStatus;
    public Id recordTypeId;
    public Id offerId;
    public Id opportunityId;
    public Id accountId;
    public String creditorName;
    public Boolean downPayment;

    public Settlement__c getSettlementInstance() {
        Settlement__c settlementInstance = new Settlement__c();
        settlementInstance.Id = this.recordId;
        settlementInstance.Settlement_Date__c = this.settlementDate;
        settlementInstance.AmountToCreditor__c = this.amountToCreditor;
        settlementInstance.Payment_Method__c = this.paymentMethod;
        settlementInstance.Payment_Method_Amount__c = this.paymentMethodAmount;
        settlementInstance.Settlement_Status__c = this.settlementStatus;
        settlementInstance.Sync_Status__c = this.settlementSyncStatus;
        settlementInstance.RecordTypeId = this.recordTypeId;
        settlementInstance.Offer__c = this.offerId;
        settlementInstance.Account__c = this.accountId;
        settlementInstance.Is_Down_Payment__c = this.downPayment;
        return settlementInstance;
    }

    public static Set<Schema.SObjectField> settlementFields = new Set<Schema.SObjectField> {
        Settlement__c.AmountToCreditor__c, Settlement__c.Payment_Method__c, Settlement__c.Payment_Method_Amount__c, Settlement__c.Settlement_Date__c
    };
}