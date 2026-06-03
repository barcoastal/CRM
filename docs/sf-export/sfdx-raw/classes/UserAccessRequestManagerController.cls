/*----------------------------------------------------------------
    Author: Yamini B
    Description: Controller class to onborad and offborad users
    Test Class: 

    History
    <Date>          <Authors Name>          <Brief Description of Change>       <Code Coverage>
    Oct-31-2024     Yamini                  Initial Development                		
--------------------------------------------------------------------*/
public class UserAccessRequestManagerController {
    
    
    public class wrapperParams{
        public String firstName;
        public String lastName;
        public String email;
        public String phoneNumber;
        public String role;
    }
    
     /**
     * Author: Yamini B
     * Description: Method to create blank records.
    */
   
    @AuraEnabled
    public static ApexActionResult createBlankRecords(Integer numberOfRecords) {
        final String SCOPE = 'UserAccessRequestManagerController.createBlankRecords';
        ApexActionResult result = new ApexActionResult(SCOPE);
        blankRecordResult resultWrap = New blankRecordResult();
        try{
            List<wrapperParams> blankRecords = new List<wrapperParams>();
            
            for (Integer i = 0; i < numberOfRecords; i++) {
                blankRecords.add(new wrapperParams());
            }
            resultWrap.blankRecordList = blankRecords;
            result.data = JSON.serialize(resultWrap); 
        }
        catch (Exception ex) {
            result.thrown(ex);
        }
        return result;
    }
    
    public class blankRecordResult{
        public List<wrapperParams> blankRecordList;
    }
    
    /**
     * Author: Yamini B
     * Description: Method to fetch active users.
    */
   
    @AuraEnabled(cacheable=true)
    public static ApexActionResult getUserList() {
        final String SCOPE = 'UserAccessRequestManagerController.getUserList';
        ApexActionResult result = new ApexActionResult(SCOPE);
        userListResult resultWrap = new userListResult();
        try{
            resultWrap.userList =  UserData.queryActiveUsers();
            result.data = JSON.serialize(resultWrap); 
        }catch (Exception ex) {
            result.thrown(ex);
        }
        return result;
    }
    
    public class userListResult{
        public List<User> userList;
    }
    
     /**
     * Author: Yamini B
     * Description: Method to fetch queues.
    */
    @AuraEnabled
    public static ApexActionResult getQueueIds() {
        final String SCOPE = 'UserAccessRequestManagerController.getQueueIds';
        ApexActionResult result = new ApexActionResult(SCOPE);
        queueResult resultWrap = new queueResult();
        Map<String, Id> queueIds = new Map<String, Id>();
        try{
            Set<String> queueNameSet = New set<String>{'Salesforce','Five9','IT Support'};
            List<Group> queueList =GroupData.fetchQueues(queueNameSet,'Queue');
               
            
            for (Group queue : queueList) {
                if (queue.Name == 'Salesforce') {
                    queueIds.put(queue.DeveloperName , queue.Id);
                } else if (queue.Name == 'Five9') {
                    queueIds.put(queue.DeveloperName, queue.Id);
                } else if (queue.Name == 'IT Support') {
                    queueIds.put(queue.DeveloperName, queue.Id);
                }
            }
            resultWrap.queueMap = queueIds;
            result.data = JSON.serialize(resultWrap);
        }catch (Exception ex) {
            result.thrown(ex);
        }
        return result;
    }
    
    public class queueResult{
        public Map<String, Id> queueMap;
    }
}