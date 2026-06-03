public with sharing class AgentMonthlyScheduler implements Schedulable {
    
    
    private Date targetDate;
    
    public AgentMonthlyScheduler() {        
        this.targetDate = Date.today();       
    }
     
    public AgentMonthlyScheduler(Integer month, Integer year) {      
        this.targetDate = Date.newInstance(year, month, 1);       
    }
    
    public AgentMonthlyScheduler(Date targetDate){
        this.targetDate = targetDate;
    } 
      
    public void execute(SchedulableContext sc) {      
        try {
            date targetDate = this.targetDate;
            String isActivePreviousMonth;
            String prevMonth;
            String prevMonthYear;
            String currentMonth;
            String currentYear;

            if(targetDate.addDays(-1).month() == targetDate.month()){
                isActivePreviousMonth = getMonthString(targetDate.addMonths(-1));
                prevMonth = getMonthString(targetDate);
                prevMonthYear = getYearString(targetDate);
                currentMonth = getMonthString(targetDate.addMonths(1));
                currentYear = getYearString(targetDate.addMonths(1));
            } else {
                isActivePreviousMonth = String.valueOf(targetDate.addMonths(-2).month() );
                prevMonth = getMonthString(targetDate.addMonths(-1));
                prevMonthYear = getYearString(targetDate);
                currentMonth = getMonthString(targetDate);
                currentYear = getYearString(targetDate);
            }

            finalizePreviousMonthAgentMonthlyTierRecords(isActivePreviousMonth,prevMonth,prevMonthYear);      
            createNewAgentMonthlyTierRecords(currentMonth,currentYear);       
        } catch (Exception ex) {            
            ApplicationLogger.logExceptionWithData(ex, null, 'Commission Structure Error',null, ApplicationLogger.SEVERITY_HIGH);
        }     
    }  
    
    private void finalizePreviousMonthAgentMonthlyTierRecords(String isActivePreviousMonth,String prevMonth, String prevMonthYear) {
    
        List<Agent_Monthly_Tier__c> prevRecords = new List<Agent_Monthly_Tier__c>();

        for(Agent_Monthly_Tier__c amt :AgentMonthlyTierData.getPreviousMonthAcitveAMT(isActivePreviousMonth)){
            amt.Is_Active_Prev_Month__c = false;
            prevRecords.add(amt);
        }

        for(Agent_Monthly_Tier__c amt : AgentMonthlyTierData.getPreviousMonthAgentMonthlyTierRecords(prevMonth, prevMonthYear)) {
            
            amt.Calculation_Status__c = AgentMonthlyTierUtil.CALCULATION_STATUS_FINALIZED;     
            amt.Record_Updated_By__c = AgentMonthlyTierUtil.SYSTEM_UPDATED;
            amt.Is_Active_Prev_Month__c = true;
            amt.Active__c = false;
            prevRecords.add(amt);
        }
        
        DMLService.performUpdateDML(prevRecords, 'AgentMonthlyScheduler');   
    }
        
    private void createNewAgentMonthlyTierRecords(String currentMonth,String currentYear) {
                
        List<Agent_Monthly_Tier__c> newRecords = new List<Agent_Monthly_Tier__c>();
        
        for(User userRecord : UserData.queryActiveClsoers()){    
            newRecords.add(createAgentMonthlyTierInstance(userRecord, currentMonth, currentYear));    
        }
        
        DMLService.performInsertDML(newRecords, 'AgentMonthlyScheduler'); 
    }
      
    private static String getMonthString(Date dateValue) {

        return String.valueOf(dateValue.month()); 
    }
       
    private static String getYearString(Date dateValue) {
        
        return String.valueOf(dateValue.year()); 
    } 
    
    private static Agent_Monthly_Tier__c createAgentMonthlyTierInstance(User userRecord, String currentMonth, String currentYear) {
        
        Agent_Monthly_Tier__c amt = new Agent_Monthly_Tier__c(); 
        amt.Closer__c = userRecord.Id;  
        amt.Month__c = currentMonth; 
        amt.Year__c = currentYear;
        amt.Record_Updated_By__c = AgentMonthlyTierUtil.SYSTEM_UPDATED;
        amt.Calculation_Status__c = AgentMonthlyTierUtil.CALCULATION_STATUS_DRAFT; 
        amt.Total_First_Payment_Collected__c = 0;
        amt.Active__c = True;
        amt.Unique_Key__c = construtUniqueKey(userRecord,currentMonth,currentYear); 
        return amt;     
    }  
    
    private static string construtUniqueKey(User userRecord, String currentMonth, String currentYear) {
        return String.valueOf(userRecord.Id) + '-' +      
        String.valueOf(currentMonth) + '-' +      
        String.valueOf(currentYear);  
    }
    
}