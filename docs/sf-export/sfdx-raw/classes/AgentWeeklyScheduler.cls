public with sharing class AgentWeeklyScheduler implements Schedulable {
    
    private Date targetDate;
    private Date startOfWeek;
    private Date endOfWeek;

    // Default Constructor - Runs for the current week
    public AgentWeeklyScheduler() {
        this.targetDate = Date.today();
        this.startOfWeek = Date.today(); 
        this.endOfWeek = Date.today().addDays(6);
    }

    // Parameterized Constructor - For manual backfills
    public AgentWeeklyScheduler(Date specificDate, Date startWeek, Date endWeek) {
        this.targetDate = specificDate;
        this.startOfWeek = startWeek;
        this.endOfWeek = endWeek;
    }
    
    public void execute(SchedulableContext sc) {
        try {
            finalizePreviousWeekAgentWeeklyPayrollRecords();
            createNewAgentWeeklyPayrollRecords();
            
            if (isLastWeeklyRunOfMonth(this.targetDate)) {
               runMonthlyProcess();
            }
        } catch (Exception ex) {
            ApplicationLogger.logExceptionWithData(ex, null, 'Commission Structure Error',null, ApplicationLogger.SEVERITY_HIGH);
        }
    }

    /**
     * Finds Draft records from the prior week and moves them to Finalized.
     */
    private void finalizePreviousWeekAgentWeeklyPayrollRecords() {
        Date prevWeekStart = this.startOfWeek.addDays(-7);
        
        List<Agent_Weekly_Payroll__c> prevRecords = AgentWeeklyPayrollData.getWeeklyPayrollByStartDateAndStatus(prevWeekStart);

        if (prevRecords.isEmpty()) return;

        for(Agent_Weekly_Payroll__c awp : prevRecords) {
            awp.Calculation_Status__c = AgentWeeklyPayrollUtil.CALCULATION_STATUS_FINALIZED;
            awp.Record_Updated_By__c = AgentWeeklyPayrollUtil.SYSTEM_UPDATED;
            awp.Active__c = false;
        }

        DMLService.performUpdateDML(prevRecords, 'AgentWeeklyScheduler');
    }

    /**
     * Creates new Payroll "buckets" for all active Closer agents for the current week.
     */
    private void createNewAgentWeeklyPayrollRecords() {
        List<User> activeClosers = UserData.queryActiveClsoers();
        if(activeClosers.isEmpty()) return;

        String monthStr = String.valueOf(this.targetDate.month());
        String yearStr = String.valueOf(this.targetDate.year());

        List<Agent_Weekly_Payroll__c> newRecords = new List<Agent_Weekly_Payroll__c>();

        for(User userRecord : activeClosers) {
            
            newRecords.add(createAgentWeeklyPayrollInstance(userRecord));
        }

        DMLService.performInsertDML(newRecords, 'AgentWeeklyScheduler');
    }   

    /**
     * Constructs the record instance with proper formatting and Tier mapping
     */
    private Agent_Weekly_Payroll__c createAgentWeeklyPayrollInstance(User userRecord) {
        Agent_Weekly_Payroll__c awp = new Agent_Weekly_Payroll__c();
        awp.Closer__c = userRecord.Id;
        awp.Start_Date__c = this.startOfWeek;
        awp.End_Date__c = this.endOfWeek;
        awp.Calculation_Status__c = AgentWeeklyPayrollUtil.CALCULATION_STATUS_DRAFT;
        awp.Record_Updated_By__c = AgentWeeklyPayrollUtil.SYSTEM_UPDATED;
        awp.Active__c = true;
        awp.Unique_Key__c = constructUniqueKey(userRecord.Id, this.startOfWeek, this.endOfWeek);
        
        return awp;
    }

    /**
     * Generates a consistent Unique Key for the record
     */
    private String constructUniqueKey(Id userId, Date startDt, Date endDt) {
        return String.valueOf(userId) + '-' + String.valueOf(startDt) + '-' + String.valueOf(endDt);
    }
    
    private Boolean isLastWeeklyRunOfMonth(Date today) {
    // If adding 7 days to today changes the month, 
    // it means there are no more Fridays left in this month.
    return today.month() != today.addDays(7).month();
    }
    
    private void runMonthlyProcess() {
        // Calculate the target date for the NEXT month
        // If today is Feb 28, this creates records for March (Month 3)
        
        // Instantiate and execute the Monthly Scheduler logic
        AgentMonthlyScheduler monthlyJob = new AgentMonthlyScheduler(this.targetDate);
        monthlyJob.execute(null); 
    }
}