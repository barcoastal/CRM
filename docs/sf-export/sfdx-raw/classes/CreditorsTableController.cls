public with sharing class CreditorsTableController {
   
    @AuraEnabled
    public static ApexActionResult getCreditorsDetails(Id recordId){


        final String SCOPE = 'CreditorsTableController.getCreditorsDetails';
        ApexActionResult result = new ApexActionResult(SCOPE);
        try{
            if(OpportunityUtil.isOppId(recordId)){
                List<Opportunity> oppRecord = OpportunityData.queryOpportunity(recordId);
                recordId = oppRecord[0].AccountId;
            }
            List<CreditorsDetailsWrapper> creditorDetailsWrapperList = new List<CreditorsDetailsWrapper>();
         
           List<Debt_Details__c> debtDetailsList =  DebtDetailsData.getAllDebtDetailByAccId(recordId);

           for(Debt_Details__c debtDetail : debtDetailsList){
              CreditorsDetailsWrapper creditorDetailsWrapper = new CreditorsDetailsWrapper();
              creditorDetailsWrapper.debtDetialId = debtDetail.Id;
                creditorDetailsWrapper.creditorName = debtDetail.Creditor_Name_Formula__c;
                //creditorDetailsWrapper.currentCreditor = debtDetail.Current_Creditor__r.Name;
                creditorDetailsWrapper.legalStatus = debtDetail.Legal_Status__c;
                creditorDetailsWrapper.negotiationStatus = debtDetail.Negotiation_Status__c;
                creditorDetailsWrapper.lienPosition = debtDetail.Lien_Position__c;
                creditorDetailsWrapper.debtAmount = debtDetail.Debt_Amount__c;
                creditorDetailsWrapper.creditorFees = 0;
                if(debtDetail.Creditor_Fees__c != null){
                   creditorDetailsWrapper.creditorFees = debtDetail.Creditor_Fees__c;
                }
                creditorDetailsWrapper.UCCFundsOnHold = 0;
                if(debtDetail.UCC_Funds_onHold__c != null){
                    creditorDetailsWrapper.UCCFundsOnHold = debtDetail.UCC_Funds_onHold__c;
                }
                creditorDetailsWrapper.DebtAmountWithFees = debtDetail.Debt_Amount_With_Fees__c;
                creditorDetailsWrapper.accountId = debtDetail.Account__c;
                creditorDetailsWrapper.opportunityId = debtDetail.Opportunity__c;

                creditorDetailsWrapperList.add(creditorDetailsWrapper);
           }
           result.data = JSON.serialize(creditorDetailsWrapperList);

        }catch(Exception exp){
            result.thrown(exp);
            System.debug('erro ' + exp);
        }

        return result;
    }
    
    @AuraEnabled
    public static ApexActionResult getOffersListOfCreditor(Id debtDetailId){
        final String SCOPE = 'CreditorsTableController.getOffersListOfCreditor';
        ApexActionResult result = new ApexActionResult(SCOPE);
        try {
            List<Debt_Details__c> debtDetial = DebtDetailsData.getProgramPlanByDebtDetials(debtDetailId);
            List<OfferWrapper> offerWrapperList = new List<OfferWrapper>();
           List<Offer__c> offerList = OfferData.getOffersListOfCreditor(debtDetailId);

           for(Offer__c offer : offerList){
             OfferWrapper offerWrapper = new OfferWrapper(offer);
             offerWrapper = calculateOfferRatios(offerWrapper,debtDetial[0]);
             offerWrapperList.add(offerWrapper);
           }
           
           result.data = JSON.serialize(offerWrapperList);
        }catch(Exception exp){
            result.thrown(exp);
            System.debug('erro ' + exp);
        }
        return result;
    }

    @AuraEnabled
    public static ApexActionResult createNewOfferInstance(Id debtId) {
        String scope = 'CreditorsTableController.createNewOfferInstance';
        ApexActionResult result = new ApexActionResult(scope);
        try {
            OfferWrapper offerWrap = new OfferWrapper();
            offerWrap.offerAmount = 0.00;
            if (debtId != null) {
                List<Debt_Details__c> debtList = DebtDetailsData.getDebtDetails(debtId);
                if (debtList != null && !debtList.isEmpty()) {
                    Debt_Details__c currentDebt = debtList[0];
                    Decimal totalDebt = 0.00;
                    for (AggregateResult ar : DebtDetailsData.aggregateDebtsIncludedInProgram(currentDebt.Opportunity__c)) {
                        totalDebt = (Decimal)ar.get('totalDebt'); 
                    }
                    offerWrap.totalDebtAmount = totalDebt;
                    offerWrap.uccFundsOnHold = currentDebt.UCC_Funds_onHold__c;
                    offerWrap.debtDetailId = debtId;
                    offerWrap.accountId = currentDebt.Account__c;
                    offerWrap.opportunityId = currentDebt.Opportunity__c;
                    offerWrap.creditorName = currentDebt.Creditor_Name__c;
                    offerWrap.offerStatus = 'In Review';
                    offerWrap.paymentMethod = 'Wire';
                    offerWrap.settlementFrequency = 'Twice Monthly';
                    calculateOfferRatios(offerWrap, currentDebt);
                }
            }
            result.data = JSON.serialize(offerWrap);
        } catch (Exception ex) {
            result.thrown(ex);
        }
        return result;
    }

    @AuraEnabled
    public static ApexActionResult getOfferDetails(Id offerId) {
        String scope = 'CreditorsTableController.getOfferDetails';
        ApexActionResult result = new ApexActionResult(scope);
        try {
            SettlementPaymentsController.OfferAndPaymentsWrapper resultWrapper = new SettlementPaymentsController.OfferAndPaymentsWrapper();
            OfferWrapper offerWrap = new OfferWrapper();
            offerWrap.offerAmount = 0.00;
            if (offerId != null) {
                List<Offer__c> offerList = OfferData.queryOffersByOfferId(offerId);
                if (offerList != null && !offerList.isEmpty()) {
                    Offer__c offerRecord = offerList[0];
                    offerWrap.offerId = offerId;
                    offerWrap.offerName = offerRecord.Name;
                    offerWrap.debtDetailId = offerRecord.Debt_Details__c;
                    offerWrap.opportunityId = offerRecord.Opportunity__c;
                    offerWrap.accountId = offerRecord.Client_Account__c;
                    offerWrap.debtAmount = offerRecord.Debt_Details__r.Debt_Amount__c;
                    offerWrap.uccFundsOnHold = offerRecord.Debt_Details__r.UCC_Funds_onHold__c;
                    offerWrap.offerAmount = offerRecord.Offer_Amount__c;
                    offerWrap.settlementFrequency = offerRecord.Settlement_Frequency__c;
                    offerWrap.settlementTerm = offerRecord.Settlement_Term__c;
                    offerWrap.settlementStartDate = offerRecord.Start_Date__c;
                    offerWrap.recurringDay = offerRecord.Recurring_Day__c;
                    offerWrap.creditorName = offerRecord.Debt_Details__r.Creditor_Name__c;
                    offerWrap.offerStatus = offerRecord.Offer_Status__c;
                    offerWrap.paymentMethod = offerRecord.Payment_Method__c;
                    offerWrap.downPayment = offerRecord.Down_Payment__c;
                    offerWrap.firstPaymentDate = offerRecord.First_Payment_Date__c;
                    offerWrap.secondPaymentDate = offerRecord.Second_Payment_Date__c;
                    Decimal totalDebt = 0.00;
                    for (AggregateResult ar : DebtDetailsData.aggregateDebtsIncludedInProgram(offerRecord.Opportunity__c)) {
                        totalDebt = (Decimal)ar.get('totalDebt'); 
                    }
                    offerWrap.totalDebtAmount = totalDebt;
                    List<Debt_Details__c> debtList = DebtDetailsData.getDebtDetails(offerWrap.debtDetailId);
                    if (debtList != null && !debtList.isEmpty()) {
                        Debt_Details__c currentDebt = debtList[0];
                        calculateOfferRatios(offerWrap, currentDebt);
                    }
                    resultWrapper.offerWrap = offerWrap;
                    resultWrapper.paymentWrappers = SettlementPaymentsController.getPayments(offerWrap);
                }
            }
            result.data = JSON.serialize(resultWrapper);
        } catch (Exception ex) {
            System.debug('getOffers error ' + ex);
            result.thrown(ex);
        }
        return result;
    }

    @AuraEnabled
    public static ApexActionResult syncSettlementRecords(String debtId) {
        final String SCOPE = 'CreditorsTableController.syncSettlementRecords';
        ApexActionResult result = new ApexActionResult(SCOPE);
        try {
            ApexActionResult apiResult = ProcessorAPI.initiateSettlementsSyncAPI(debtId); 
            copyApexActionResult(result, apiResult);       
        } catch (Exception ex) {
            ApplicationLogger.logException(ex, debtId);
            result.thrown(ex);
        }
        return result;
    }

    private static void copyApexActionResult(ApexActionResult source, ApexActionResult target) {
        source.status = target.status;
        source.message = target.message;
        source.data = target.data;
    }

    public static offerWrapper calculateOfferRatios(offerWrapper offerWrapper, Debt_Details__c debtDetail) {
        offerwrapper.debtAmount = debtDetail.Debt_Amount__c;
        offerWrapper.totalDebtAmount = Integer.valueOf(debtDetail.Program_Plan__r.Total_Debt__c);
        offerWrapper.estSettlementPercentage = Integer.valueOf(debtDetail.Program_Plan__r.Settlement_Percentage__c);
        offerWrapper.minPaymentRatio =  ApexUtil.roundOffAmount( ( debtDetail.Debt_Amount__c / debtDetail.Program_Plan__r.Total_Debt__c ) * 100 );
        offerWrapper.maxPaymentRatio =   ApexUtil.roundOffAmount( ( ( debtDetail.Debt_Amount__c * 1.25 )/ debtDetail.Program_Plan__r.Total_Debt__c ) * 100 );
        if (debtDetail.Program_Plan__r.Weekly_Draft_Amount__c != null) {
            offerWrapper.draftAmountPerPayment = debtDetail.Program_Plan__r.Weekly_Draft_Amount__c;
            offerWrapper.minimumMonthlyPayment =  ApexUtil.roundOffAmount( ( (debtDetail.Program_Plan__r.Weekly_Draft_Amount__c * 4) * offerWrapper.minPaymentRatio ) / 100 );
            offerWrapper.maximumMonthlyPayments =  ApexUtil.roundOffAmount( ( (( debtDetail.Program_Plan__r.Weekly_Draft_Amount__c * 4) * offerWrapper.maxPaymentRatio )) / 100 ) ;
        }
        if (offerWrapper.offerAmount != null && offerWrapper.settlementTerm != null) {
            Integer numberOfPayments = Integer.valueOf(offerWrapper.settlementTerm);
            if(offerWrapper.settlementFrequency == 'Twice Monthly'){
                numberOfPayments = Integer.valueOf(offerWrapper.settlementTerm) * 2;
            }
            offerWrapper.settlementAmountPerPayment = ApexUtil.roundOffAmount( (offerWrapper.downPayment != null && offerWrapper.downPayment > 0 ? (offerWrapper.offerAmount - offerWrapper.downPayment) / ( numberOfPayments  - 1 ): (offerWrapper.offerAmount) / numberOfPayments ) );
            offerWrapper.actualSettlementPercentage =  ApexUtil.roundOffAmount( ( offerWrapper.offerAmount / debtDetail.Debt_Amount__c ) * 100 ) ;
            offerWrapper.diffInPercentage =  offerWrapper.actualSettlementPercentage -  offerWrapper.estSettlementPercentage;
            offerWrapper.diffInAmount =  ApexUtil.roundOffAmount( (  offerWrapper.offerAmount - ( (debtDetail.Debt_Amount__c * offerWrapper.estSettlementPercentage ) / 100 )  ) );
        } 
        return offerWrapper;
    }

    public class CreditorsDetailsWrapper {
        public Id debtDetialId;
        public String creditorName;
        public String currentCreditor;
        public String legalStatus;
        public String negotiationStatus;
        public String lienPosition;
        public Decimal debtAmount;
        public Decimal creditorFees;
        public Decimal DebtAmountWithFees;
        public Decimal UCCFundsOnHold;
        public Id accountId;
        public Id opportunityId;
        public Id debtDetailId; 
    }
}