public without sharing class QuoteTriggerHandler extends TriggerHandler {
    
    /*@description: Method to execute logic in the before insert trigger event.*/
    public override void beforeInsert() {
        Set<Id> opportunityIds = new Set<Id>();
        for (Quote quoteInstance : (List<Quote>)Trigger.new) {
            opportunityIds.add(quoteInstance.OpportunityId);
        }
        
        Map<Id, Opportunity> opportunitiesMap = new Map<Id, Opportunity>([SELECT Id, Name, Current_Total_Debt__c, Estimated_Total_Debt__c, Current_Weekly_Payment__c FROM Opportunity WHERE Id IN :opportunityIds]);
        Map<Id, Program_Plan__c> programPlansMap = new Map<Id, Program_Plan__c>();
        for(Program_Plan__c programPlan : [SELECT Id, Opportunity__c, Settlement_Percentage__c, Program_Fee_Percentage__c FROM Program_Plan__c WHERE Opportunity__c IN :opportunityIds]) {
            programPlansMap.put(programPlan.Opportunity__c, programPlan);
        }
        
        for (Quote quoteInstance : (List<Quote>)Trigger.new) {
            Opportunity opp = opportunitiesMap.get(quoteInstance.OpportunityId);
            Program_Plan__c programPlanRec = programPlansMap.get(quoteInstance.OpportunityId);
            getQuoteDetails(quoteInstance, opp, programPlanRec);
        }
    }
    
    public static void getQuoteDetails(Quote quoteInstance, Opportunity opp, Program_Plan__c programPlanRec) {
        if (opp != null && programPlanRec != null) {
            Decimal currentTotalDebt = opp.Current_Total_Debt__c != null ? opp.Current_Total_Debt__c : 0;
            Decimal currentWeeklyPayment = opp.Current_Weekly_Payment__c != null ? opp.Current_Weekly_Payment__c : 0;
            
            Decimal settlementPercentage = !String.isBlank(programPlanRec.Settlement_Percentage__c) ? Decimal.valueOf(programPlanRec.Settlement_Percentage__c) : 0;
            Decimal programFeePercentage = !String.isBlank(programPlanRec.Program_Fee_Percentage__c) ? Decimal.valueOf(programPlanRec.Program_Fee_Percentage__c) : 0;
            
            Integer programLength1 = (quoteInstance.Program_Length_1__c != null && quoteInstance.Program_Length_1__c != 0) ?
                Integer.valueOf(quoteInstance.Program_Length_1__c) : 0;
            
            Integer programLength2 = (quoteInstance.Program_Length_2__c != null && quoteInstance.Program_Length_2__c != 0) ?
                Integer.valueOf(quoteInstance.Program_Length_2__c) : 0;
            
            quoteInstance.Total_Debt__c = currentTotalDebt;
            quoteInstance.Current_Weekly_Payment__c = currentWeeklyPayment;
            
            // Create the new Quote Name format: "Opportunity Name - DateTimeStamp"
            String newQuoteName = opp.Name + ' - ' + Datetime.now().formatGMT('yyyyMMddHHmmss');
            quoteInstance.Name = newQuoteName;
            
            if (programLength1 != null && programLength1 != 0) {
                Decimal newTotalDebt1 = calculateNewTotalDebt(programLength1, currentTotalDebt, settlementPercentage, programFeePercentage);
                quoteInstance.New_Total_Debt_1__c = newTotalDebt1;
                Decimal newWeeklyPayment1 = calculateNewWeeklyPayment(programLength1, currentTotalDebt, settlementPercentage, programFeePercentage);
                quoteInstance.New_Weekly_Payment_1__c = newWeeklyPayment1;
                quoteInstance.Estimated_Weekly_Savings_1__c = quoteInstance.Current_Weekly_Payment__c - quoteInstance.New_Weekly_Payment_1__c;
                quoteInstance.Estimated_Savings_1__c = quoteInstance.Total_Debt__c - quoteInstance.New_Total_Debt_1__c;
                
            } else {
                // Set values to zero when programLength1 is null or zero
                quoteInstance.New_Total_Debt_1__c = 0;
                quoteInstance.New_Weekly_Payment_1__c = 0;
                quoteInstance.Estimated_Weekly_Savings_1__c = 0;
                quoteInstance.Estimated_Savings_1__c = 0;
            }
            
            if (programLength2 != null && programLength2 != 0) {
                Decimal newTotalDebt2 = calculateNewTotalDebt(programLength2, currentTotalDebt, settlementPercentage, programFeePercentage);
                quoteInstance.New_Total_Debt_2__c = newTotalDebt2;
                Decimal newWeeklyPayment2 = calculateNewWeeklyPayment(programLength2, currentTotalDebt, settlementPercentage, programFeePercentage);
                quoteInstance.New_Weekly_Payment_2__c = newWeeklyPayment2;
                quoteInstance.Estimated_Weekly_Savings_2__c = quoteInstance.Current_Weekly_Payment__c - quoteInstance.New_Weekly_Payment_2__c;
                quoteInstance.Estimated_Savings_2__c = quoteInstance.Total_Debt__c - quoteInstance.New_Total_Debt_2__c;
                
            } else {
                // Set values to zero when programLength2 is null or zero
                quoteInstance.New_Total_Debt_2__c = 0;
                quoteInstance.New_Weekly_Payment_2__c = 0;
                quoteInstance.Estimated_Weekly_Savings_2__c = 0;
                quoteInstance.Estimated_Savings_2__c = 0;
            }
            
        }
    }
    
    // Method to calculate New_Total_Debt_1__c using PaymentCalculator class
    private static Decimal calculateNewTotalDebt(Integer programLength, Decimal currentTotalDebt, Decimal settlementPercentage , Decimal programFeePercentage) {
        Payment_Calculator_Settings__c paymentCalcSettings = Payment_Calculator_Settings__c.getInstance();
        Decimal monthlyServiceFee = paymentCalcSettings != null ? paymentCalcSettings.Monthly_Service_Fee__c : 0;
        PaymentCalculatorElements paymentCalcElements = new PaymentCalculatorElements();
        paymentCalcElements.frequency = ProgramPlanUtil.FREQUENCY_WEEKLY;
        paymentCalcElements.paymentTerm = programLength;
        paymentCalcElements.weeklyPaymentDay = 'Monday';
        paymentCalcElements.totalDebt = currentTotalDebt;
        paymentCalcElements.settlementPercent = settlementPercentage;
        paymentCalcElements.programFeePercent = programFeePercentage;
        paymentCalcElements.serviceFee = monthlyServiceFee;
        PaymentCalculator paymentCalculator = new PaymentCalculator(paymentCalcElements);
        return paymentCalculator.getNewTotalDebtAmount();
    }
    
    // Method to calculate New_Weekly_Payment_1__c using PaymentCalculator class
    private static Decimal calculateNewWeeklyPayment(Integer programLength, Decimal currentTotalDebt, Decimal settlementPercentage , Decimal programFeePercentage) {
        Payment_Calculator_Settings__c paymentCalcSettings = Payment_Calculator_Settings__c.getInstance();
        Decimal monthlyServiceFee = paymentCalcSettings != null ? paymentCalcSettings.Monthly_Service_Fee__c : 0;
        PaymentCalculatorElements paymentCalcElements = new PaymentCalculatorElements();
        paymentCalcElements.frequency = ProgramPlanUtil.FREQUENCY_WEEKLY;
        paymentCalcElements.paymentTerm = programLength;
        paymentCalcElements.weeklyPaymentDay = 'Monday';
        paymentCalcElements.totalDebt = currentTotalDebt;
        paymentCalcElements.settlementPercent = settlementPercentage;
        paymentCalcElements.programFeePercent = programFeePercentage;
        paymentCalcElements.serviceFee = monthlyServiceFee;
        PaymentCalculator paymentCalculator = new PaymentCalculator(paymentCalcElements);
        return paymentCalculator.getIndividualPaymentAmount();
    }
    
    
}