public inherited sharing class PaymentCalculatorElements {
    public String frequency; 
    public Integer paymentTerm;
    public Decimal totalDebt = 0.00;
    public Decimal settlementPercent = 0.00;
    public Decimal programFeePercent = 0.00;
    public Decimal retainerPercent = 0.00;
    public Decimal setupFee = 0.00;
    public Decimal serviceFee = 0.00;
    public Decimal citadelFee = 0.00;
    public Decimal monthlyBankFee = 0.00;
    public Decimal bankSetupFee = 0.00;
    public String firstPaymentDate; 
    public Integer firstPaymentDay;
    public Integer secondPaymentDay;
    public String weeklyPaymentDay;
    public Boolean businessClient = false;
    public Integer noOfPayments1stMonth = 2;
    public Id opportunityId;
    public Id parentProgramPlanId;
    public Decimal completedDraftsAmount;
    public Integer completedDraftsCount = 0;
    public Date lastDraftCompletedDate;
    public Integer additionalMonthForCitadelFee = 0;
     
    public Integer noOfPayments;
    public Boolean isFirstMonthHasMultiplePayments = true;
    public Integer noOfActualPayments;
    public Integer noOfActualMonths;
    public Decimal totalPaymentAmount;
    public Date firstPaymentDateValue;
    public Boolean isCompletedRetainer = false;
    public Boolean isRetainerPayment = false;
    public Decimal completedRetainerAmount = 0.00;
    public Integer completedRetainerCount = 0;
    public String monthYearSetForCitadel;


    public void performPrerequisites() {
        if (firstPaymentDateValue == null) {
            firstPaymentDateValue = convertDateStringToDate();
        }
        noOfPayments1stMonth = getNoOfPayments1stMonth();
        isFirstMonthHasMultiplePayments = getIsFirstMonthHasMultiplePayments();
        noOfPayments = getNoOfPayments();
        noOfActualPayments = getNoOfActualPayments();
        noOfActualMonths = getNoOfActualMonths();
        totalPaymentAmount = getTotalPaymentAmount();
        firstPaymentDay = getFirstPaymentDay();
        secondPaymentDay = getSecondPaymentDay();
    }

    private Date convertDateStringToDate() {
        if (String.isNotBlank(firstPaymentDate)) {
            String dtString = firstPaymentDate.substringBefore('T');
            List<String> dateElements = dtString.Split('-');
            return Date.newInstance(
                Integer.valueOf(dateElements[0]), 
                Integer.valueOf(dateElements[1]), 
                Integer.valueOf(dateElements[2])
            );
        }
        return System.today().addDays(1);
    }

    private Integer getNoOfPayments1stMonth() {
        if (lastDraftCompletedDate != null && lastDraftCompletedDate.day() < secondPaymentDay) {
            return 1;
        } else {
            return (firstPaymentDateValue.day() >= secondPaymentDay) ? 1 : 2;
        }
    }

    private Boolean getIsFirstMonthHasMultiplePayments() {
        if (frequency == ProgramPlanUtil.FREQUENCY_MONTHLY && businessClient) {
            return false;
        } else if (frequency == ProgramPlanUtil.FREQUENCY_BI_MONTHLY && noOfPayments1stMonth == 1) {
            return false;
        } else if (frequency == ProgramPlanUtil.FREQUENCY_WEEKLY) {
            if (lastDraftCompletedDate != null) {
                return false;
            }
            if (firstPaymentDateValue.month() != getNextWeeklyPaymentDate(firstPaymentDateValue).month()) {
                return false;
            }
        }
        return true;
    }

    private Date getNextWeeklyPaymentDate(Date dateValue) {
        return dateValue.addDays(7).toStartOfWeek().addDays(getWeeklyPaymentDay());
    }

    public Integer getNoOfPayments() {
        Integer noOfPayments;
        Integer paymentTermTemp = paymentTerm;
        if (lastDraftCompletedDate != null) {
            paymentTermTemp = getPaymentTermExcludingCompletedMonths(paymentTermTemp);
        }
        if (frequency == ProgramPlanUtil.FREQUENCY_MONTHLY) {
            noOfPayments = paymentTermTemp;
        } else if (frequency == ProgramPlanUtil.FREQUENCY_BI_MONTHLY) {
            Date programEndDate = getProgramEndDate(paymentTermTemp);
            noOfPayments = calcNoOfPaymentsBiMonthly(programEndDate);
        } else if (frequency == ProgramPlanUtil.FREQUENCY_WEEKLY) {
            Date programEndDate = getProgramEndDate(paymentTermTemp);
            noOfPayments = calcNoOfPaymentsWeekly(programEndDate); 
        } else if (frequency == ProgramPlanUtil.FREQUENCY_DAILY) {
            Date programEndDate = getProgramEndDate(paymentTermTemp);
            noOfPayments = calcNoOfPaymentsDaily(programEndDate); 
        }
        return noOfPayments;
    } 

    private Integer getPaymentTermExcludingCompletedMonths(Integer paymentTermTemp) {
        Date programEndDate = getActualProgramEndDate(paymentTermTemp);
        Date nextMonthDate = lastDraftCompletedDate.addMonths(1).toStartOfMonth();
        Integer noOfMonthsBetween = nextMonthDate.monthsBetween(programEndDate) + 1;
        return noOfMonthsBetween;
    }

    private Integer getNoOfActualPayments() {
        return (paymentTerm * 4) - 1;
    }

    private Date getActualProgramEndDate(Integer paymentTermTemp) {
        Date programStartDate = convertDateStringToDate();
        return programStartDate.addMonths(paymentTermTemp).toStartOfMonth().addDays(-1);
    }

    private Date getProgramEndDate(Integer paymentTermTemp) {
        Date programStartDate = firstPaymentDateValue; 
        return programStartDate.addMonths(paymentTermTemp).toStartOfMonth().addDays(-1);
    }

    private Integer calcNoOfPaymentsBiMonthly(Date programEndDate) {
        Date nextMonthStartDate = firstPaymentDateValue;
        if (businessClient && lastDraftCompletedDate == null) {
            nextMonthStartDate = getNextMonthStartDate(firstPaymentDateValue);
        } /*else if (lastDraftCompletedDate != null) {
            nextMonthStartDate = lastDraftCompletedDate;
        }*/
        //nextMonthStartDate = getNextMonthStartDate(firstPaymentDateValue);
        return ((nextMonthStartDate.monthsBetween(programEndDate) + 1 ) * 2) + noOfPayments1stMonth;
    }

    private Date getNextMonthStartDate(Date dateValue) {
        return dateValue.addMonths(1).toStartOfMonth();
    }

    private Integer calcNoOfPaymentsWeekly(Date programEndDate) {
        Integer noOfPayments = 0; 
        Date nextWeekStartDate;
        if (lastDraftCompletedDate != null) {
            nextWeekStartDate = getNextWeekStartDate(lastDraftCompletedDate);
        } else {
            nextWeekStartDate = getNextWeekStartDate(firstPaymentDateValue);
            noOfPayments = 1; //Including the first payment of the schedule
        }
        //Adding +1 to include nextWeekStartDate also in the calculation
        Integer noOfDays = nextWeekStartDate.daysBetween(programEndDate) + 1; 
        noOfPayments += (noOfDays/7);
        Integer remainder = math.mod(noOfDays, 7);
        noOfPayments += (remainder > getWeeklyPaymentDay() ? 1 : 0);     
        return noOfPayments;
    }

    private Integer calcNoOfPaymentsDaily(Date programEndDate) {
        Integer noOfPayments = 0; 
        if (lastDraftCompletedDate != null) {
            noOfPayments = lastDraftCompletedDate.daysBetween(programEndDate);
        } else {
            noOfPayments = firstPaymentDateValue.daysBetween(programEndDate);
        }
        return noOfPayments;
    }

    private Date getNextWeekStartDate(Date dateValue) {
        return dateValue.addDays(7).toStartOfWeek();
    }

    public Integer getWeeklyPaymentDay() {
        if (weeklyPaymentDay.endsWithIgnoreCase('Sunday')) {
            return 0;
        } else if (weeklyPaymentDay.endsWithIgnoreCase('Monday')) {
            return 1;
        } else if (weeklyPaymentDay.endsWithIgnoreCase('Tuesday')) {
            return 2;
        } else if (weeklyPaymentDay.endsWithIgnoreCase('Wednesday')) {
            return 3;
        } else if (weeklyPaymentDay.endsWithIgnoreCase('Thursday')) {
            return 4;
        } else if (weeklyPaymentDay.endsWithIgnoreCase('Friday')) {
            return 5;
        } else if (weeklyPaymentDay.endsWithIgnoreCase('Saturday')) {
            return 6;
        }
        return null;
    }
    //We are commenting the First Month Has Multiple Payments when the date are near end of the month 
    private Integer getNoOfActualMonths() {
        return paymentTerm;//isFirstMonthHasMultiplePayments ? paymentTerm : (paymentTerm-1);
    }

    private Decimal getTotalPaymentAmount() {
        return getSettlementAmount() 
        + getProgramFeeAmount() 
        + (getServiceFee() * ((paymentTerm * 4) - 1)) 
        + (getMonthlyBankFee() * paymentTerm)
        + (getCitadelFee() * paymentTerm)
        + (getCitadelFee() * (additionalMonthForCitadelFee == null ? 0 : additionalMonthForCitadelFee))
        + getBankSetupFee()
        - ((completedDraftsAmount != null && completedDraftsAmount > 0) ? completedDraftsAmount : 0.00);
    }
    
    // This method is to calculate new Total Debt (or) new Total Program Cost
    public Decimal getNewTotalDebtAmount() {
        return getSettlementAmount() 
        + getProgramFeeAmount() 
        + (getServiceFee() * ((paymentTerm * 4) - 1)) 
        + (getMonthlyBankFee() * paymentTerm)
        + (getCitadelFee() * paymentTerm)
        + (getCitadelFee() * (additionalMonthForCitadelFee == null ? 0 : additionalMonthForCitadelFee))
        + getBankSetupFee()
        + getRetainerAmount() 
        + getSetupFee();
    }

    private Decimal getSettlementAmount() {
        return totalDebt * (settlementPercent/100);
    }

    public Decimal getProgramFeeAmount() {
        return totalDebt * (programFeePercent/100);
    }

    public Decimal getServiceFee() {
        return returnValue(serviceFee);
    }

    public Decimal getCitadelFee() {
        return returnValue(citadelFee);
    }

    public Decimal getMonthlyBankFee() {
        return returnValue(monthlyBankFee);
    }

    public Decimal getBankSetupFee() {
        return returnValue(bankSetupFee);
    }

    private Decimal returnValue(Decimal value) {
        return value != null ? value : 0.00;
    }

    public Integer getFirstPaymentDay() {
        return firstPaymentDay != null ? firstPaymentDay : 1;
    }

    public Integer getSecondPaymentDay() {
        return secondPaymentDay != null ? secondPaymentDay : 1;
    }

    public Decimal getRetainerAmount() {
        return totalDebt * (retainerPercent/100);
    }

    public Decimal getSetupFee() {
        return setupFee != null ? setupFee : 0.00;
    }

    public Decimal getTotalAmountPerMonth() {
        return totalPaymentAmount/((paymentTerm * 4 - 1) - (completedDraftsCount));
    }
}