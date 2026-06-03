public inherited sharing class OfferWrapper {
    public Id offerId;
    public String offerName;
    public String createdByName;
    public Date createdDate;
    public String settlementFrequency;
    public String settlementTerm;
    public Date settlementStartDate;
    public String recurringDay;
    public String offerStatus;
    public Decimal offerAmount;
    public String paymentMethod;
    public Decimal paymentMethodAmount;
    public Id opportunityId;
    public Id accountId;
    public Id debtDetailId;
    public Decimal debtAmount;
    public Decimal totalSettlementAmount;
    public Decimal totalDebtAmount;
    public Decimal minimumMonthlyPayment;
    public Decimal maximumMonthlyPayments;
    public Decimal draftAmountPerPayment;
    public Decimal uccFundsOnHold;
    public Decimal settlementAmountPerPayment;
    public Decimal minPaymentRatio;
    public Decimal maxPaymentRatio;
    public Decimal estSettlementPercentage;
    public Decimal actualSettlementPercentage;
    public Decimal diffInPercentage;
    public Decimal diffInAmount;
    public String creditorName;
    public Decimal downPayment;
    public String firstPaymentDate;
    public String secondPaymentDate;

    public OfferWrapper() {

    }

    public OfferWrapper(Offer__c OffersInstance){
        this.settlementTerm = OffersInstance.Settlement_Term__c;
        this.settlementFrequency = OffersInstance.Settlement_Frequency__c;
        this.settlementStartDate = OffersInstance.Start_Date__c;
        this.totalSettlementAmount = OffersInstance.Total_Settlement_Amount__c;
        this.paymentMethod = OffersInstance.Payment_Method__c;
        this.paymentMethodAmount = OffersInstance.Payment_Method_Amount__c;
        this.opportunityId = OffersInstance.Opportunity__c;
        this.accountId = OffersInstance.Client_Account__c;
        this.offerId = OffersInstance.Id;
        this.recurringDay = OffersInstance.Recurring_Day__c;
        this.offerStatus = OffersInstance.Offer_Status__c;
        this.offerAmount = OffersInstance.Offer_Amount__c;
        this.offerName = OffersInstance.Name;
        this.debtDetailId = OffersInstance.Debt_Details__c;
        this.downPayment = OffersInstance.Down_Payment__c;
        this.firstPaymentDate = OffersInstance.First_Payment_Date__c;
        this.secondPaymentDate = OffersInstance.Second_Payment_Date__c;
       }

    public Offer__c getOfferInstance() {
        Offer__c offerInstance = new Offer__c();
        offerInstance.Id = this.offerId;
        offerInstance.Settlement_Frequency__c = this.settlementFrequency;
        offerInstance.Settlement_Term__c = String.valueOf(this.settlementTerm);
        offerInstance.Start_Date__c = this.settlementStartDate;
        offerInstance.Recurring_Day__c = String.valueOf(this.recurringDay);
        offerInstance.Offer_Status__c = this.offerStatus;
        offerInstance.Offer_Amount__c = this.offerAmount;
        offerInstance.Payment_Method__c = this.paymentMethod;
        offerInstance.Payment_Method_Amount__c = this.paymentMethodAmount;
        offerInstance.Opportunity__c = this.opportunityId;
        offerInstance.Client_Account__c = this.accountId;
        offerInstance.Debt_Details__c = this.debtDetailId;
        offerInstance.Down_Payment__c = this.downPayment;
        offerInstance.First_Payment_Date__c = this.firstPaymentDate;
        offerInstance.Second_Payment_Date__c = this.secondPaymentDate;
        return offerInstance;
    }
}