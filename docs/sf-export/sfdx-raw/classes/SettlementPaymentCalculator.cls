public inherited sharing class SettlementPaymentCalculator {
    public static Boolean isFirstPaymentDate = true;
    public static Boolean isFirstPayment = true;
    public static Date startDate;

    public static List<SettlementWrapper> calculateSettlementPayments(OfferWrapper offerWrap, List<Settlement__c> existingSettlements, List<Settlement__c> downPaymentRecord) {
        isFirstPaymentDate = true;
        isFirstPayment = true;
        List<SettlementWrapper> settlementWrappers = new List<SettlementWrapper>();
        Id recTypeId = ApexUtil.getRecordTypeIdbyDeveloperName('Settlement__c', 'Offered_Settlements');
        Payment_Processor__c paymentProc = PaymentProcessorData.queryPaymentProcessor(offerWrap.opportunityId);
        Date currentDate = offerWrap.settlementStartDate;
        startDate = offerWrap.settlementStartDate;
        Decimal paymentMethodAmount = getPaymentMethodFee(paymentProc, offerWrap);
        Integer numberOfPayments = getNumberOfPayments(offerWrap);
        Decimal amountToCreditorPerPayment = getAmountToCreditor(offerWrap, numberOfPayments);
        Decimal runningBalance = 0.00;
        integer currentIteration = 0;
        if(offerWrap.downPayment != null && offerWrap.downPayment > 0){
            amountToCreditorPerPayment = getAmountToCreditorAfterDownPayment(offerWrap,numberOfPayments - 1);
            SettlementWrapper settlementWrap = new SettlementWrapper();
            if(downPaymentRecord != null && downPaymentRecord.size() > 0){
                settlementWrap.recordId = downPaymentRecord[0].Id;
            }
            settlementWrap.paymentNo = currentIteration + 1;
            settlementWrap.settlementDate = currentDate;
            settlementWrap.amountToCreditor = offerWrap.downPayment;
            settlementWrap.paymentMethod = offerWrap.paymentMethod;
            settlementWrap.paymentMethodAmount = paymentMethodAmount;
            settlementWrap.totalSettlementAmount = settlementWrap.amountToCreditor + settlementWrap.paymentMethodAmount;
            settlementWrap.settlementRunningBalance = runningBalance + settlementWrap.amountToCreditor;
            settlementWrap.recordTypeId = recTypeId;
            settlementWrap.offerId = offerWrap.offerId;
            settlementWrap.opportunityId = offerWrap.opportunityId;
            settlementWrap.accountId = offerWrap.accountId;
            settlementWrap.creditorName = offerWrap.creditorName;
            settlementWrap.downPayment = true;
            settlementWrappers.add(settlementWrap);
            currentDate = getNextPaymentDate(currentDate, offerWrap);
            runningBalance = settlementWrap.settlementRunningBalance;
            currentIteration = currentIteration + 1;
        }
        /** Related to CRM-2141: We commented below validation temporarily
        if (offerWrap.settlementFrequency == 'Weekly' && (amountToCreditorPerPayment * 4  > offerWrap.maximumMonthlyPayments) ){
            throw new CustomException('Simulated Settlement Amount [$' + (amountToCreditorPerPayment * 4) + '] is exceeding the maximum Monthly Payment Amount [$' + offerWrap.maximumMonthlyPayments + ']' );
        }
        if ( (offerWrap.settlementFrequency == 'Twice Monthly' ? amountToCreditorPerPayment * 2 : amountToCreditorPerPayment ) > offerWrap.maximumMonthlyPayments) {
            throw new CustomException('Simulated Settlement Amount [$' + (offerWrap.settlementFrequency == 'Twice Monthly' ? amountToCreditorPerPayment * 2 : amountToCreditorPerPayment ) + '] is exceeding the maximum Monthly Payment Amount [$' + offerWrap.maximumMonthlyPayments +']');
        }
        if (offerWrap.downPayment >= offerWrap.offerAmount) {
            throw new CustomException('Down Payment [$' + offerWrap.downPayment + '] cannot be greater than or equal to Offer Amount [$' + offerWrap.offerAmount +']');
        }*/
        if(amountToCreditorPerPayment > 0){
            for (Integer i = currentIteration; i < numberOfPayments; i++) {
                SettlementWrapper settlementWrap = new SettlementWrapper();
                if (existingSettlements != null && existingSettlements.size() > i) {
                    settlementWrap.recordId = existingSettlements[i].Id;
                }
                settlementWrap.paymentNo = i + 1;
                settlementWrap.settlementDate = currentDate;
                settlementWrap.amountToCreditor = amountToCreditorPerPayment;
                settlementWrap.paymentMethod = offerWrap.paymentMethod;
                settlementWrap.paymentMethodAmount = paymentMethodAmount;
                settlementWrap.totalSettlementAmount = settlementWrap.amountToCreditor + settlementWrap.paymentMethodAmount;
                settlementWrap.settlementRunningBalance = runningBalance + settlementWrap.amountToCreditor;
                settlementWrap.recordTypeId = recTypeId;
                settlementWrap.offerId = offerWrap.offerId;
                settlementWrap.opportunityId = offerWrap.opportunityId;
                settlementWrap.accountId = offerWrap.accountId;
                settlementWrap.creditorName = offerWrap.creditorName;
                settlementWrappers.add(settlementWrap);
                currentDate = getNextPaymentDate(currentDate, offerWrap);
                runningBalance = settlementWrap.settlementRunningBalance;
            }
        }   
        return settlementWrappers;
    }

    private static Decimal getPaymentMethodFee(Payment_Processor__c paymentProc, OfferWrapper offerWrap) {
        Decimal paymentMethodFee = 0.00;
        if (paymentProc != null) {
            if (offerWrap.paymentMethod.equalsIgnoreCase('Wire') && paymentProc.Wire_Settlement_Fee__c != null && paymentProc.Wire_Settlement_Fee__c > 0) {
                paymentMethodFee = paymentProc.Wire_Settlement_Fee__c;
            } 
        }
        return paymentMethodFee;
    }

    public static Integer getNumberOfPayments(OfferWrapper offerWrap) {
        Integer numberOfPayments = Integer.valueOf(offerWrap.settlementTerm);
        if (offerWrap.settlementFrequency.equalsIgnoreCase('Monthly')) {
            numberOfPayments = Integer.valueOf(offerWrap.settlementTerm);
        }else if (offerWrap.settlementFrequency.equalsIgnoreCase('Twice Monthly')){
            numberOfPayments = Integer.valueOf(offerWrap.settlementTerm) * 2;
        }else if (offerWrap.settlementFrequency.equalsIgnoreCase('Weekly')) {
            numberOfPayments = Integer.valueOf(offerWrap.settlementTerm) * 4;
        }
        return numberOfPayments;
    }

    private static Decimal getAmountToCreditor(OfferWrapper offerWrap, Integer numberOfPayments) {
        return ApexUtil.roundOffAmount( offerWrap.offerAmount /numberOfPayments);
    }

    public static Date getNextPaymentDate(Date currentDate, OfferWrapper offerWrap) {
        Date nextPaymentDate = currentDate;
        if (offerWrap.settlementFrequency.equalsIgnoreCase('Monthly')) {
            nextPaymentDate = getNextPaymentDateMonthly(currentDate, offerWrap);
        }else if (offerWrap.settlementFrequency.equalsIgnoreCase('Twice Monthly')){
            nextPaymentDate = getNextPaymentDateTwiceMonthly(currentDate, offerWrap);
        }else if(offerWrap.settlementFrequency.equalsIgnoreCase('Weekly')){
            nextPaymentDate = getNextPaymentDateWeekly(currentDate, offerWrap);
        }
        return nextPaymentDate;
    }

    private static Date getNextPaymentDateWeekly(Date currentDate, OfferWrapper offerWrap) {
        Date newWeekDate = currentDate.addDays(7);
        return Date.newInstance(newWeekDate.year(), newWeekDate.month(), newWeekDate.day());
    }

    private static Date getNextPaymentDateTwiceMonthly(Date currentDate, OfferWrapper offerWrap) {
        Date newBiWeekDate = currentDate;
        Integer secondPaymentDate = Integer.valueOf(offerWrap.secondPaymentDate);
        if((isFirstPaymentDate == true && isFirstPayment == false) || (isFirstPayment == true && (Integer.valueOf(offerWrap.secondPaymentDate) <= startDate.day()))){
            currentDate = currentDate.addMonths(1);
        }
        if(secondPaymentDate > Date.daysInMonth(currentDate.year(), currentDate.month()) ){
            secondPaymentDate = Date.daysInMonth(currentDate.year(), currentDate.month());
        }
        if(isFirstPayment == true && (secondPaymentDate > startDate.day())){
            Date nextDate = currentDate.toStartOfMonth().addDays((secondPaymentDate - 1));
          
            newBiWeekDate = currentDate.toStartOfMonth().addDays((secondPaymentDate - 1));

            isFirstPaymentDate = true;
            isFirstPayment = false;
            return Date.newInstance(newBiWeekDate.year(), newBiWeekDate.month(), newBiWeekDate.day());
        }
      
        if(isFirstPaymentDate == true ){
            Date nextDate = currentDate.toStartOfMonth().addDays((Integer.valueOf(offerWrap.firstPaymentDate) - 1));

            newBiWeekDate = currentDate.toStartOfMonth().addDays((Integer.valueOf(offerWrap.firstPaymentDate) - 1));
            isFirstPaymentDate = false;
        }else {
            newBiWeekDate = currentDate.toStartOfMonth().addDays((secondPaymentDate -1));
            isFirstPaymentDate = true;
        }
        isFirstPayment = false;
        return Date.newInstance(newBiWeekDate.year(), newBiWeekDate.month(), newBiWeekDate.day());
    }

    private static Date getNextPaymentDateMonthly(Date currentDate, OfferWrapper offerWrap) {
        Date nextMonthDate = currentDate.addMonths(1);
        return Date.newInstance(nextMonthDate.year(), nextMonthDate.month(), Integer.valueOf(offerWrap.recurringDay));
    }

    private static Decimal getAmountToCreditorAfterDownPayment(OfferWrapper offerWrap, Integer numberOfPayments) {
        return ApexUtil.roundOffAmount( (offerWrap.offerAmount - offerWrap.downPayment) /numberOfPayments);
    }
}