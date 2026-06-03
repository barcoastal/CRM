public inherited sharing class PaymentCalculator {
    public PaymentCalculatorElements payCalcElements;
    public List<DraftWrapper> draftWrapperList;
    public Boolean appliedBankSetupFee = false;
    private set<String> monthYearSet = new Set<String>();
    public Boolean is1stMonthHasMultiplePayments =  false;
    public Map<String, Integer> monthYearNoOfPaymentsMap = new Map<String, Integer>();
    public Set<String> monthYearToSkip = new Set<String>();
    public Set<String> monthYearSetForCitadel = new Set<String>();
    public Decimal appliedProgramFee = 0.00;

    public PaymentCalculator(PaymentCalculatorElements paymentCalcElementWrapper) {
        ApexUtil.requireValue('Payment Calculator Elements', paymentCalcElementWrapper);
        this.payCalcElements = paymentCalcElementWrapper;
        payCalcElements.performPrerequisites();
        this.draftWrapperList = new List<DraftWrapper>();
        validatePayCalcElements();
    }

    private void validatePayCalcElements() {
        System.debug('ToDo: Build the validation logic');
    }

    /** This method is used to get the one individual payment amonut */
    /** Needed params for weekly payment: 
     * frequency, 
     * paymentTerm, 
     * weeklyPaymentDay,
     * totalDebt, 
     * settlementPercent, 
     * programFeePercent, 
     * ServiceFee
    */  
    public Decimal getIndividualPaymentAmount() {
        return getTotalAmount();
    }

    public List<DraftWrapper> rescheduleProgram() {
        Integer noOfActualPayments = payCalcElements.noOfActualPayments;
        /*if (payCalcElements.lastDraftCompletedDate != null) {
            addToMonthDate(payCalcElements.lastDraftCompletedDate);
            monthYearToSkip.add(getMonthYearValue(payCalcElements.lastDraftCompletedDate));
        }*/
        //createRetainerSetupFeeRecord();
        /*for (Integer i = 1; i <= noOfActualPayments; i++) {
            DraftWrapper draftWrapInstance = createDraftInstance(i);
            draftWrapperList.add(draftWrapInstance);
        }*/
        //DraftWrapper lastDraftRetainerSetup;
        Date currentDate = payCalcElements.firstPaymentDateValue;
        for (Integer i = 0; i < noOfActualPayments; i++) {
            DraftWrapper draftWrapper = constructDraftsDate(currentDate, i == 0 && payCalcElements.isCompletedRetainer ? false : true);
            //DraftWrapper draftWrapper = constructDrafts(i, currentDate);
            currentDate = draftWrapper.paymentDate;
            draftWrapperList.add(draftWrapper);
            /*DraftWrapper draftWrap = draftWrapperList[i-1];
            if (isRetainerSetupFeeParent(draftWrap)) {
                lastDraftRetainerSetup = createDraftInstanceRetainerSetup(draftWrap);
            } else {
                createDraftInstanceWithAmounts(draftWrap, i, lastDraftRetainerSetup);
                lastDraftRetainerSetup = null;
            }*/
        }
        for (DraftWrapper draftWrap : draftWrapperList) {
            constructDraftsAmount(draftWrap);
        }
        return draftWrapperList;
    }

    private DraftWrapper constructDraftsDate(Date currentDate, Boolean isCalculateNextPayment) {
        DraftWrapper draftWrap = new DraftWrapper();
        draftWrap.paymentDate = isCalculateNextPayment ? getNextPaymentDate(currentDate) : currentDate;
        return draftWrap;
        //draftWrap.processorSetupFee = getProcessorSetupFeeAmount(draftWrap);
        //Decimal paymentAmount = getPaymentAmount(draftWrap);
        //draftWrap.programFee = getProgramFeeValue(paymentAmount);
        //draftWrap.paymentAmount = paymentAmount - draftWrap.programFee - draftWrap.processorSetupFee;
        //draftWrap.processorFee += draftWrap.processorSetupFee;
    }

    private void constructDraftsAmount(DraftWrapper draftWrap) {
        draftWrap.retainerFee = 0.00;
        draftWrap.setupFee = 0.00;
        draftWrap.processorFee = getProcessorFee(draftWrap);
        draftWrap.serviceFee = getServiceFee(draftWrap);
        draftWrap.citaldelFee = getCitadelFee(draftWrap);
        draftWrap.totalAmount = getTotalAmount();
        if (String.isBlank(draftWrap.draftStatus)) {
            draftWrap.draftStatus = 'Pending';
        }
        draftWrap.programPlanId = payCalcElements.parentProgramPlanId;
    }

    private Decimal getProcessorFee(DraftWrapper draftWrap) {
        Decimal processorFeeValue = 0.00;
        String monthYearString = getMonthYearValue(draftWrap.paymentDate);
        if (monthYearNoOfPaymentsMap.containsKey(monthYearString)) {
            if (!monthYearToSkip.contains(monthYearString)) {
                processorFeeValue = payCalcElements.getMonthlyBankFee();
                monthYearToSkip.add(monthYearString);
            }
        }
        return ApexUtil.roundOffAmount(processorFeeValue);
    }

    private Decimal getProcessorSetupFeeAmount(DraftWrapper draftWrap) {
        Decimal processorsetupFeeValue = 0.00;
        if (!appliedBankSetupFee && payCalcElements.lastDraftCompletedDate == null) {
            processorsetupFeeValue = payCalcElements.getBankSetupFee();
            appliedBankSetupFee = true;
        }
        return ApexUtil.roundOffAmount(processorsetupFeeValue);
    }

    private Decimal getServiceFee(DraftWrapper draftWrap) {
        Decimal serviceFeeValue = payCalcElements.getServiceFee();
        return ApexUtil.roundOffAmount(serviceFeeValue);
    }

    private Decimal getCitadelFee(DraftWrapper draftWrap) {
        Decimal citadelFeeValue = 0.00;
        String monthYearString = getMonthYearValue(draftWrap.paymentDate);

        if (!monthYearSetForCitadel.contains(monthYearString)) {
            citadelFeeValue = payCalcElements.getCitadelFee();
            monthYearSetForCitadel.add(monthYearString);
        }
        return ApexUtil.roundOffAmount(citadelFeeValue);
    }

    public Decimal getTotalAmount() {
       return ApexUtil.roundOffAmount(payCalcElements.getTotalAmountPerMonth());
    }

    /*private Date getPaymentDate(Integer paymentNo, Date currentDate) {
        if (paymentNo == 0) {
            return currentDate;
        } else {
            return getNextPaymentDate(currentDate);
        }
    }*/
        /*if (isFirstPaymentOfSchedule(previousDraft)) {
            Date firstPaymentDate = payCalcElements.firstPaymentDateValue;
            if (payCalcElements.noOfPayments1stMonth == 1) {
                addDateToMonthYearSet(firstPaymentDate);
            }
            return firstPaymentDate;
        } else {
            
        }
        return getNextPaymentDate(currentDate);
    }*/

    private Date getNextPaymentDate(Date currentDate) {
        Date nextPaymentDate;
        if (payCalcElements.frequency == ProgramPlanUtil.FREQUENCY_WEEKLY) {
            nextPaymentDate = getNextPaymentDateWeekly(currentDate);
        }
        /*if (payCalcElements.frequency == ProgramPlanUtil.FREQUENCY_MONTHLY) {
            nextPaymentDate = getNextPaymentDateMonthly(currentDate);
        } else if (payCalcElements.frequency == ProgramPlanUtil.FREQUENCY_BI_MONTHLY) {
            nextPaymentDate = getNextPaymentDateBiMonthly(currentDate);
        } else if (payCalcElements.frequency == ProgramPlanUtil.FREQUENCY_DAILY) {
            nextPaymentDate = getNextPaymentDateDaily(currentDate);
        }*/
        return nextPaymentDate;
    }

    /*private Date getNextPaymentDateMonthly(Date currentDate) {
        /*DraftWrapper prevDraft = getPrevDraft(previousDraft);
        Date nextPaymentDate = getNextMonth1stPaymentDate(prevDraft.paymentDate);
        currentDraft.isFirstPaymentInMonth = true;
        if (!isChildRetainerSetupFeeRecord(currentDraft)) {
            addToMonthDate(nextPaymentDate);
        }
        return nextPaymentDate;*/
        /*Date nextPaymentDate = getNextMonth1stPaymentDate(currentDate);
        addToMonthDate(nextPaymentDate);
        return nextPaymentDate;
    }*/

    /*private Date getNextPaymentDateBiMonthly(Date currentDate) {
        Date nextPaymentDate;
        String monthYearString = getMonthYearValue(currentDate);
        if (monthYearNoOfPaymentsMap.containsKey(monthYearString)
            && monthYearNoOfPaymentsMap.get(monthYearString) == 1
        ) {
            if (currentDate.day() < payCalcElements.secondPaymentDay) {
                nextPaymentDate = getNextMonth2ndPaymentDate(currentDate);
            } else {
                nextPaymentDate = getNextMonth1stPaymentDate(currentDate);
            }
            addToMonthDate(nextPaymentDate);
        } else {
            if (currentDate.day() < payCalcElements.secondPaymentDay) {
                nextPaymentDate = Date.newInstance(
                    currentDate.year(),
                    currentDate.month(),
                    payCalcElements.secondPaymentDay
                );
            } else {
                nextPaymentDate = getNextMonth1stPaymentDate(currentDate);
            }
            addToMonthDate(nextPaymentDate);
        }
        /*//*DraftWrapper prevDraft = getPrevDraft(previousDraft);
        if (monthYearSet.contains(getMonthYearValue(currentDate))) {
            nextPaymentDate = getNextMonth1stPaymentDate(currentDate);
            addToMonthDate(nextPaymentDate);
            /*currentDraft.isFirstPaymentInMonth = true;
            if (!isChildRetainerSetupFeeRecord(currentDraft)) {
                addToMonthDate(nextPaymentDate);
            }
        } else {
            nextPaymentDate = getNextMonth2ndPaymentDate(currentDate);
            addDateToMonthYearSet(nextPaymentDate);
            /*if (!isChildRetainerSetupFeeRecord(currentDraft)) {
                addDateToMonthYearSet(nextPaymentDate);
            }*/
            //currentDraft.isFirstPaymentInMonth = false;
            /*if (prevDraft.firstPaymentOfSchedule != null && prevDraft.firstPaymentOfSchedule) {
                is1stMonthHasMultiplePayments = true;
            }
            if (!isChildRetainerSetupFeeRecord(currentDraft)) {
                addToMonthDate(nextPaymentDate);
            }
        }*/
        /*return nextPaymentDate;
    }*/

    private Date getNextPaymentDateWeekly(Date currentDate) {
        Date nextWeekDate = currentDate.addDays(7);
        Date nextWeekStartDate = nextWeekDate.toStartOfWeek();
        Date nextPaymentDate = nextWeekStartDate.addDays(payCalcElements.getWeeklyPaymentDay());
        addToMonthDate(nextPaymentDate);
        /*if (!isChildRetainerSetupFeeRecord(currentDraft)) {
            addToMonthDate(nextPaymentDate);
        }
        DraftWrapper prevDraft = getPrevDraft(previousDraft);

        if (prevDraft.paymentDate.month() != nextPaymentDate.month()) {
            currentDraft.isFirstPaymentInMonth = true;
            addDateToMonthYearSet(nextPaymentDate);
        } else {
            currentDraft.isFirstPaymentInMonth = false;
            if (prevDraft.firstPaymentOfSchedule != null && prevDraft.firstPaymentOfSchedule) {
                is1stMonthHasMultiplePayments = true;
            }
        }*/
        return nextPaymentDate;
    }

    /*private Date getNextPaymentDateDaily(Date currentDate) {
        return currentDate.addDays(1);
    }*/

    /*private Date getNextMonth1stPaymentDate(Date currentDate) {
        Date nextMonthDate = currentDate.addMonths(1);
        return Date.newInstance(nextMonthDate.year(), nextMonthDate.month(), payCalcElements.firstPaymentDay);
    }*/

    /*private Date getNextMonth2ndPaymentDate(Date currentDate) {
        return Date.newInstance(currentDate.year(), currentDate.month(), payCalcElements.secondPaymentDay);
    }*/

    /*private void addDateToMonthYearSet(Date dateValue) {
        monthYearSet.add(getMonthYearValue(dateValue));
    }*/

    private void addToMonthDate(Date dateValue) {
        String monthYearString = getMonthYearValue(dateValue);
        if (!monthYearNoOfPaymentsMap.containsKey(monthYearString)) {
            monthYearNoOfPaymentsMap.put(monthYearString, 0);
        }
        monthYearNoOfPaymentsMap.put(monthYearString, monthYearNoOfPaymentsMap.get(monthYearString) + 1);
    }

    //private Map<String, Integer> secondDatemonthYearNoOfPaymentsMap = new Map<String, Integer>();
    /*private void addToSecondDateMonthMap(Date dateValue) {
        String monthYearString = getMonthYearValue(dateValue);
        if (!monthYearNoOfPaymentsMap.containsKey(monthYearString)) {
            monthYearNoOfPaymentsMap.put(monthYearString, 0);
        }
        monthYearNoOfPaymentsMap.put(monthYearString, monthYearNoOfPaymentsMap.get(monthYearString) + 1);
    }*/

    private string getMonthYearValue(Date dateValue) {
        return dateValue.month() + '-' + dateValue.year();
    }

    /*public Decimal getPaymentAmount(DraftWrapper draftWrap) {
        return ApexUtil.roundOffAmount(draftWrap.totalAmount - draftWrap.serviceFee - draftWrap.processorFee);
    }

    private Decimal getProgramFeeValue(Decimal paymentAmount) {
        Decimal programFee = 0.00;
        Decimal paymentAmtPercent = new PaymentCalculatorSettings().minSavingsCollectionPercentMonthly;
        if (paymentAmtPercent == null) {
            paymentAmtPercent = 30.00;
        }
        Decimal programFeePercent = 100 - paymentAmtPercent;
        Decimal programFeeAmountTemp = paymentAmount * (programFeePercent/100);
        Decimal programFeeYetToCollect = payCalcElements.getProgramFeeAmount() - appliedProgramFee;
        if (programFeeYetToCollect > programFeeAmountTemp) {
            programFee = programFeeAmountTemp;
        } else {
            programFee =  programFeeYetToCollect;
        }
        appliedProgramFee += programFee;
        return programFee;
    }*/

    /*private DraftWrapper createRetainerSetupFeeRecord(Integer paymentNo) {
        DraftWrapper draftWrap = new DraftWrapper();
        draftWrap.draftStatus = 'Pending';
        draftWrap.uniqueId = 'Parent' + paymentNo;
        draftWrap.programPlanId = payCalcElements.parentProgramPlanId;
        draftWrap.previousDraft = getPreviousDraft(paymentNo);
        draftWrap.firstPaymentOfSchedule = isFirstPaymentOfSchedule(draftWrap.previousDraft);
        draftWrap.paymentDate = getPaymentDate(paymentNo, draftWrap, draftWrap.previousDraft);
        draftWrap.retainerFee = ApexUtil.roundOffAmount(getRetainerFee(draftWrap));
        draftWrap.setupFee = ApexUtil.roundOffAmount(getSetupFee(draftWrap));
        draftWrap.totalAmount = draftWrap.retainerFee + draftWrap.setupFee;
        draftWrap.childrens = createChildRecords(draftWrap);
        return draftWrap;
    }

    private DraftWrapper getPreviousDraft(Integer paymentNo) {
        if (!draftWrapperList.isEmpty()) {
            return draftWrapperList[paymentNo-2];
        } else if (payCalcElements.lastDraftCompletedDate != null) {
            DraftWrapper draftWrap = new DraftWrapper();
            draftWrap.paymentDate = payCalcElements.lastDraftCompletedDate;
            return draftWrap;
        }
        return null;
    }*/

    /*private DraftWrapper createDraftInstanceRetainerSetup(DraftWrapper draftWrap) {
        draftWrap.retainerFee = ApexUtil.roundOffAmount(getRetainerFee(draftWrap));
        draftWrap.setupFee = ApexUtil.roundOffAmount(getSetupFee(draftWrap));
        draftWrap.totalAmount = draftWrap.retainerFee + draftWrap.setupFee;
        draftWrap.retainerSetupFeeRecord = true;
        draftWrap.processorFee = 0.00;
        draftWrap.serviceFee = 0.00;
        draftWrap.programFee = 0.00;
        draftWrap.paymentAmount = 0.00;
        draftWrap.runningBalance = 0.00;
        if (draftWrap.childrens != null && !draftWrap.childrens.isEmpty()) {
            return draftWrap.childrens[draftWrap.childrens.size() - 1];
        }
        return null;
    }*/
    /*private List<DraftWrapper> createChildRecords(DraftWrapper draftWrap) {
        List<DraftWrapper> childWrappers = new List<DraftWrapper>();
        Decimal splitAmount = 500;
        Decimal collectedAmount = 0.00;
        Decimal collectedRetainerFee = 0.00;
        Decimal collectedSetupFee = 0.00;
        Decimal amountRemainingPerRecord = 0.00;
        Integer noOfChildPayments = (Integer)(draftWrap.totalAmount/splitAmount).setScale(0, RoundingMode.UP);
        for (Integer i=0; i<noOfChildPayments; i++) {
            DraftWrapper previousDraft;
            if (i==0) {
                previousDraft = draftWrap;
            } else {
                previousDraft = childWrappers[i-1];
            }
            DraftWrapper draftWrapChild = new DraftWrapper();
            draftWrapChild.uniqueId = 'Child' + i;
            draftWrapChild.draftStatus = 'Pending';
            if (i==0) {
                draftWrapChild.paymentDate = draftWrap.paymentDate;
            } else {
                draftWrapChild.paymentDate = getPaymentDate(0, draftWrapChild, previousDraft);
            }
            System.debug('draftWrapChild.paymentDate---->'+draftWrapChild.paymentDate);
            draftWrapChild.processorFee = 0.00;
            draftWrapChild.serviceFee = 0.00;
            draftWrapChild.programFee = 0.00;
            draftWrapChild.paymentAmount = 0.00;
            draftWrapChild.runningBalance = 0.00;
            if ((draftWrap.totalAmount - collectedAmount) > splitAmount) {
                draftWrapChild.totalAmount = splitAmount;
            } else {
                draftWrapChild.totalAmount = draftWrap.totalAmount - collectedAmount;
            }
            collectedAmount += draftWrapChild.totalAmount;
            amountRemainingPerRecord = draftWrapChild.totalAmount;
            if ((draftWrap.retainerFee - collectedRetainerFee) > amountRemainingPerRecord) {
                draftWrapChild.retainerFee = amountRemainingPerRecord;
            } else {
                draftWrapChild.retainerFee = draftWrap.retainerFee - collectedRetainerFee;
            }
            collectedRetainerFee += draftWrapChild.retainerFee;
            amountRemainingPerRecord -= draftWrapChild.retainerFee;
            if ((draftWrap.setupFee - collectedSetupFee) > amountRemainingPerRecord) {
                draftWrapChild.setupFee = amountRemainingPerRecord;
            } else {
                draftWrapChild.setupFee = draftWrap.setupFee - collectedSetupFee;
            }
            collectedSetupFee += draftWrapChild.setupFee;
            childWrappers.add(draftWrapChild);
        }
        return childWrappers;
    }*/

    /*private void createDraftInstanceWithAmounts(DraftWrapper draftWrap, Integer paymentNo, DraftWrapper previousDraft) {
        draftWrap.retainerFee = ApexUtil.roundOffAmount(getRetainerFee(draftWrap));
        draftWrap.setupFee = ApexUtil.roundOffAmount(getSetupFee(draftWrap));
        draftWrap.processorFee = ApexUtil.roundOffAmount(getProcessorFee(draftWrap));
        draftWrap.processorSetupFee = ApexUtil.roundOffAmount(getProcessorSetupFeeAmount(draftWrap));
        draftWrap.serviceFee = ApexUtil.roundOffAmount(getServiceFee(draftWrap));
        draftWrap.totalAmount = ApexUtil.roundOffAmount(getTotalAmount(draftWrap));
        Decimal paymentAmount = ApexUtil.roundOffAmount(getPaymentAmount(draftWrap));
        draftWrap.programFee = getProgramFeeValue(paymentAmount);
        draftWrap.paymentAmount = paymentAmount - draftWrap.programFee - draftWrap.processorSetupFee;
        draftWrap.processorFee += draftWrap.processorSetupFee;
    }

    private Decimal getRetainerFee(DraftWrapper draftWrap) {
        Decimal retainerFeeValue = 0.00;
        if (isRetainerSetupFeeParent(draftWrap)) {
            retainerFeeValue = payCalcElements.getRetainerAmount();
        }
        return retainerFeeValue;
    }

    private Decimal getSetupFee(DraftWrapper draftWrap) {
        Decimal setupFeeValue = 0.00;
        if (isRetainerSetupFeeParent(draftWrap)) {
            setupFeeValue = payCalcElements.getSetupFee();
        }
        return setupFeeValue;
    }*/

    /*private Decimal getProcessorFee(DraftWrapper draftWrap) {
        Decimal processorFeeValue = 0.00;
        if (isRetainerSetupFeeParent(draftWrap)) {
            processorFeeValue = 0.00;
        } else {
            String monthYearString = getMonthYearValue(draftWrap.paymentDate);
            if (monthYearNoOfPaymentsMap.containsKey(monthYearString)) {
                if (!monthYearToSkip.contains(monthYearString)) {
                    processorFeeValue = payCalcElements.getMonthlyBankFee()/monthYearNoOfPaymentsMap.get(monthYearString);
                }
            }
        }
        return processorFeeValue;
    }*/
    /*private Decimal getPaymentAmountValue(Decimal paymentAmount) {
        Decimal paymentAmtPercent = new PaymentCalculatorSettings().minSavingsCollectionPercentMonthly;
        if (paymentAmtPercent == null) {
            paymentAmtPercent = 30.00;
        }
        return paymentAmount * (paymentAmtPercent/100);
    }*/

    /*private Decimal calculateRunningBalance(DraftWrapper draftWrap, Integer paymentNo) {
        Decimal previousRunningBalance = 0.00;
        if (paymentNo > 1) {
            previousRunningBalance = draftWrapperList[paymentNo - 2].runningBalance;
        }
        return draftWrap.totalAmount + previousRunningBalance;
    }*/

    /*private Boolean isFirstPaymentOfSchedule(DraftWrapper previousDraft) {
        return previousDraft == null;
    }*/

    /*private DraftWrapper getPrevDraft(DraftWrapper previousDraft) {
        /*DraftWrapper prevDraft;
        if (previousDraft != null) {
            if (previousDraft.childrens != null && !previousDraft.childrens.isEmpty()) {
                prevDraft = previousDraft.childrens[previousDraft.childrens.size() - 1];
            } else {
                prevDraft = previousDraft;
            }
        }*/
        /*return previousDraft;
    }*/

    /*private Boolean isRetainerSetupFeeParent(DraftWrapper draftWrap) {
        return payCalcElements.businessClient && draftWrap.firstPaymentOfSchedule;
    }

    private Boolean isChildRetainerSetupFeeRecord(DraftWrapper currentDraft) {
        return currentDraft.uniqueId.startsWith('Child');
    }*/
    
    public Decimal getNewTotalDebtAmount() {
        return payCalcElements.getNewTotalDebtAmount();
    } 
}