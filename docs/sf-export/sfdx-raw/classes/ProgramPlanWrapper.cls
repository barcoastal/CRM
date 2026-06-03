public inherited sharing class ProgramPlanWrapper {

    public static Set<String> programPlanFields = new Set<String> {
        'Id', 'Payment_Term__c', 'Payment_Frequency__c', 'Retainer_Percentage__c', 'Settlement_Percentage__c',
        'Program_Fee_Percentage__c', 'Payment_Processor__c', 'Payment_Processor__r.Monthly_Bank_Fee__c', 'Payment_Processor__r.Name',
        'Payment_Processor__r.Bank_Setup_Fee__c', 'Setup_Fee__c', 'First_Payment_Date__c', 
        'Next_Payment_Day__c', 'Second_Payment_Day__c', 'Weekly_Payment_Day__c', 'Opportunity__c','Opportunity__r.AccountId',
        'Completed_Drafts_Amount__c', 'Completed_Drafts_Count__c', 'Next_Draft_Date__c', 'Last_Completed_Draft_Date__c',
        'Last_Rescheduled_By__c', 'Last_Rescheduled_Date_Time__c', 'Total_Debt__c', 'Client__r.Reschedule_Program_Pending__c'
    };

    public ProgramPlanWrapper() {
    }

    public ProgramPlanWrapper(Program_Plan__c prgmPlan) {
        if (prgmPlan != null) {
            this.recordId = prgmPlan.Id;
            this.paymentTerm = prgmPlan.Payment_Term__c;
            this.paymentFrequency = prgmPlan.Payment_Frequency__c;
            this.retainerPercentage = prgmPlan.Retainer_Percentage__c;
            this.settlementPercentage = prgmPlan.Settlement_Percentage__c;
            this.programFeePercentage = prgmPlan.Program_Fee_Percentage__c;
            this.monthlyBankFee = prgmPlan.Payment_Processor__r.Monthly_Bank_Fee__c;
            this.bankSetupFee = prgmPlan.Payment_Processor__r.Bank_Setup_Fee__c;
            this.paymentProcessorId = prgmPlan.Payment_Processor__c;
            this.paymentProcessorName = prgmPlan.Payment_Processor__r.Name;
            this.setupFee = prgmPlan.Setup_Fee__c;
            this.firstPaymentDate = prgmPlan.First_Payment_Date__c;
            this.nextPaymentDay = prgmPlan.Next_Payment_Day__c;
            this.secondPaymentDay = prgmPlan.Second_Payment_Day__c;
            this.weeklyPaymentDay = prgmPlan.Weekly_Payment_Day__c;
            this.opportunityId = prgmPlan.Opportunity__c;
            this.completedDraftsAmount = prgmPlan.Completed_Drafts_Amount__c;
            this.completedDraftsCount = prgmPlan.Completed_Drafts_Count__c;
            this.nextDraftDate = prgmPlan.Next_Draft_Date__c;
            this.lastCompletedDraftDate = prgmPlan.Last_Completed_Draft_Date__c;
            this.businessClient = true;
            this.lastRescheduledById = prgmPlan.Last_Rescheduled_By__c;
            this.lastRescheduledDateTime = prgmPlan.Last_Rescheduled_Date_Time__c;
            this.totalDebt = prgmPlan.Total_Debt__c;
            this.rescheduleProgramPending = prgmPlan.Client__r.Reschedule_Program_Pending__c;
            this.accountId = prgmPlan.Opportunity__r.AccountId;
        }
    }

    public Program_Plan__c getProgramPlanInstance() {
        Program_Plan__c programPlan = new Program_Plan__c();
        programPlan.Id = recordId;
        programPlan.Opportunity__c = opportunityId;
        programPlan.Settlement_Percentage__c = String.valueOf(settlementPercentage);
        programPlan.Program_Fee_Percentage__c = String.valueOf(programFeePercentage);
        programPlan.Retainer_Percentage__c = String.valueOf(retainerPercentage);
        programPlan.Payment_Frequency__c = paymentFrequency;
        programPlan.Setup_Fee__c = setupFee;
        programPlan.Payment_Term__c = String.valueOf(paymentTerm);
        programPlan.First_Payment_Date__c = firstPaymentDate;
        programPlan.Next_Payment_Day__c = nextPaymentDay;
        programPlan.Second_Payment_Day__c = secondPaymentDay;
        programPlan.Weekly_Payment_Day__c = weeklyPaymentDay;
        programPlan.Total_Debt__c = totalDebt;
        programPlan.No_of_Debts__c = noOfDebts;
        return programPlan;
    }

    public Boolean programRescheduledAlready() {
        return this.lastRescheduledById != null || this.lastRescheduledDateTime != null;
    }

    public Id recordId {
        get; set;
    }

    public Id accountId {
        get; set;
    }

    public String paymentTerm {
        get; set;
    }

    public String paymentFrequency {
        get; set;
    }

    public String retainerPercentage {
        get; set;
    }

    public String settlementPercentage {
        get; set;
    }

    public String programFeePercentage {
        get; set;
    }

    public Decimal monthlyBankFee {
        get; set;
    }

    public Decimal bankSetupFee {
        get; set;
    }

    public String paymentProcessorId {
        get; set;
    }

    public String paymentProcessorName {
        get; set;
    }

    public String setupFee {
        get; set;
    }

    public Date firstPaymentDate {
        get; set;
    }

    public String nextPaymentDay {
        get; set;
    }

    public String secondPaymentDay {
        get; set;
    }

    public String weeklyPaymentDay {
        get; set;
    }

    public Id opportunityId {
        get; set;
    }    

    public Boolean businessClient {
        get; set;
    }

    public Decimal completedDraftsAmount {
        get; set;
    }

    public Decimal completedDraftsCount {
        get; set;
    }

    public Date nextDraftDate {
        get; set;
    }

    public Date lastCompletedDraftDate {
        get; set;
    }

    public Decimal totalDebt {
        get; set;
    }

    public Decimal noOfDebts {
        get; set;
    }

    public Id lastRescheduledById {
        get; set;
    }

    public DateTime lastRescheduledDateTime {
        get; set;
    }

    public Boolean rescheduleProgramPending {
        get; set;
    }
}