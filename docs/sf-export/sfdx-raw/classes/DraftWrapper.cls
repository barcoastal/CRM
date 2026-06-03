public inherited sharing class DraftWrapper implements Comparable {

    public Id recordId {
        get; set;
    }

    public Id clientSFId {
        get; set;
    }

    public String debitScheduleId {
        get; set;
    }

    public Date paymentDate {
        get; set;
    }

    public String draftStatus {
        get; set;
    }

    public Decimal retainerFee {
        get; set;
    }

    public Decimal serviceFee {
        get; set;
    }

    public Decimal citaldelFee {
        get; set;
    }

    public Decimal processorFee {
        get; set;
    }

    public Decimal processorSetupFee {
        get; set;
    }

    public Decimal processorSetupFeeRAM {
        get; set;
    }

    public Decimal setupFee {
        get; set;
    }

    public Decimal paymentAmount {
        get; set;
    }

    public Decimal programFee {
        get; set;
    }

    public Decimal totalAmount {
        get; set;
    }

    public Decimal totalAmountExclMPA {
        get; set;
    }

    public Decimal runningBalance {
        get; set;
    }

    public Boolean isFirstPaymentInMonth {
        get; set;
    }

    public DraftWrapper previousDraft {
        get; set;
    }

    public Id programPlanId {
        get; set;
    }

    public Id opportunityId {
        get; set;
    }

    public Boolean firstPaymentOfSchedule {
        get; set;
    }

    public List<DraftWrapper> childrens {
        get; set;
    }

    public Boolean retainerSetupFeeRecord {
        get; set;
    }

    public String uniqueId {
        get; set;
    }

    /*public String externalProcId {
        get; set;
    }*/

    public String externalSASId {
        get; set;
    }

    public String externalRAMId {
        get; set;
    }

    public String clientExternalProcId {
        get; set;
    }

    public List<Payouts> payouts {
        get; set;
    }

    public List<RAMFeeRecord> RAMFeeRecords {
        get; set;
    }

    public Boolean wirePayment {
        get; set;
    }

    public Decimal wireFee {
        get; set;
    }

    public String wireType {
        get; set;
    }

    public Draft__c getDraftInstance() {
        Draft__c draftRecord = new Draft__c();
        draftRecord.Id = recordId;
        draftRecord.Draft_Amount__c = paymentAmount;
        draftRecord.Draft_Date__c = paymentDate;
        draftRecord.Retainer_Fee__c = retainerFee;
        draftRecord.Setup_Fee__c = setupFee;
        draftRecord.Processor_Fee__c = processorFee;
        draftRecord.Service_Fee__c = serviceFee;
        draftRecord.Citadel_Fee__c = citaldelFee;
        draftRecord.Draft_Status__c = draftStatus;
        draftRecord.Program_Fee__c = programFee;
        draftRecord.Program_Plan__c = programPlanId;
        draftRecord.Account__c = clientSFId;
        return draftRecord;
    }

    public DraftWrapper() {
    }

    public DraftWrapper(Draft__c draftRecord) {
        this.recordId = draftRecord.Id;
        this.clientSFId = draftRecord.Program_Plan__r.Client__c;
        this.debitScheduleId = draftRecord.Program_Plan__r.Debit_Schedule_Id__c;
        this.paymentAmount = draftRecord.Draft_Amount__c;
        this.paymentDate = draftRecord.Draft_Date__c;
        this.retainerFee = draftRecord.Retainer_Fee__c;
        this.setupFee = draftRecord.Setup_Fee__c;
        this.processorFee = draftRecord.Processor_Fee__c;
        this.serviceFee = draftRecord.Service_Fee__c;
        this.citaldelFee = draftRecord.Citadel_Fee__c;
        this.draftStatus = draftRecord.Draft_Status__c;
        this.programPlanId = draftRecord.Program_Plan__c;
        this.opportunityId = draftRecord.Program_Plan__r.Opportunity__c;
        this.totalAmount = draftRecord.Draft_Total_Amount__c;
        this.totalAmountExclMPA = draftRecord.Draft_Total_Excl_Monthly_Processor_Fee__c;
        this.programFee = draftRecord.Program_Fee__c;
        this.retainerSetupFeeRecord = draftRecord.Retainer_SetupFee_Draft__c;
        this.externalSASId = draftRecord.External_SAS_Id__c;
        this.externalRAMId = draftRecord.External_RAM_Id__c;
        this.clientExternalProcId = draftRecord.Program_Plan__r.Client__r.External_SAS_Id__c;
        this.wirePayment = draftRecord.Wire_Payment__c;
        this.wireFee = draftRecord.Wire_Fee__c;
        this.wireType = draftRecord.Wire_Type__c;
        if (draftRecord.Fees__r != null && !draftRecord.Fees__r.isEmpty()) {
            List<Payouts> payoutsList = new List<Payouts>();
            List<RAMFeeRecord> RAMFeeRecordList = new List<RAMFeeRecord>();
            for (Fee__c feeRecord : draftRecord.Fees__r) {
                if (String.isNotBlank(feeRecord.RecordType.DeveloperName)
                    && FeeUtil.FEES_INTEGRATION_SUPPORTED.contains(feeRecord.RecordType.DeveloperName)
                ) {
                    Payouts payoutRecord = new Payouts();
                    payoutRecord.Amount = feeRecord.Fee_Amount__c;
                    payoutRecord.PayoutDate = feeRecord.Fee_Date__c;
                    payoutRecord.FeeType = feeRecord.RecordType.DeveloperName;
                    RAMFeeRecord RAMFeeRecordInst = new RAMFeeRecord();
                    RAMFeeRecordInst.Amount = feeRecord.Fee_Amount__c;
                    RAMFeeRecordInst.FeeType = feeRecord.RecordType.DeveloperName;
                    if (feeRecord.RecordType.DeveloperName == FeeUtil.RT_RETAINER_FEE) {
                        payoutRecord.PayeeID = feeRecord.Program_Plan__r.Payment_Processor__r.Retainer_Fee_Payee_Id__c;
                    } else if (feeRecord.RecordType.DeveloperName == FeeUtil.RT_SETUP_FEE) {
                        payoutRecord.PayeeID = feeRecord.Program_Plan__r.Payment_Processor__r.Setup_Fee_Payee_Id__c;
                    } else if (feeRecord.RecordType.DeveloperName == FeeUtil.RT_SERVICE_FEE) {
                        payoutRecord.PayeeID = feeRecord.Program_Plan__r.Payment_Processor__r.Service_Fee_Payee_Id__c;
                    } else if (feeRecord.RecordType.DeveloperName == FeeUtil.RT_CITADEL_FEE) { //Added Citadel Fee Payee Id 
                        payoutRecord.PayeeID = feeRecord.Program_Plan__r.Payment_Processor__r.Citadel_Fee_Payee_Id__c;
                    } else if (feeRecord.RecordType.DeveloperName == FeeUtil.RT_PROGRAM_FEE) { 
                        payoutRecord.PayeeID = feeRecord.Program_Plan__r.Payment_Processor__r.Program_Fee_Payee_Id__c;
                    }
                    payoutsList.add(payoutRecord);
                    RAMFeeRecordList.add(RAMFeeRecordInst);
                }
                
            }
            this.payouts = payoutsList;
            this.RAMFeeRecords = RAMFeeRecordList;
        }
    }

    public Integer compareTo(Object compareTo) {
        DraftWrapper other = (DraftWrapper) compareTo;
        if (this.paymentDate > other.paymentDate)
          return 1;
        else if (this.paymentDate <= other.paymentDate)
          return 0;
        return -1;
    }

    public static Map<String, String> fieldNameLabelMap = new Map<String, String> {
        'recordId' => 'Draft Id',
        'totalAmount' => 'Draft Total Amount',
        'totalAmountExclMPA' => 'Draft Total Amount',
        'clientExternalProcId' => 'External Processor Id',
        'paymentAmount' => 'Draft Amount',
        'paymentDate' => 'Draft Date',
        'externalRAMId' => 'External RAM Id'
    };

    public static Set<Schema.SObjectField> draftFields = new Set<Schema.SObjectField> {
        Draft__c.Draft_Date__c, Draft__c.Draft_Amount__c, Draft__c.Retainer_Fee__c, Draft__c.Setup_Fee__c, 
        Draft__c.Processor_Fee__c, Draft__c.Service_Fee__c, Draft__c.Program_Fee__c, Draft__c.Citadel_Fee__c
    };

    //Following the naming conventions as per the external system.
    public class Payouts {
        public String PayeeID;
        public Date PayoutDate;
        public Decimal Amount;
        public String FeeType;
    }

    public class RAMFeeRecord {
        public Decimal Amount;
        public String FeeType;
    }
}