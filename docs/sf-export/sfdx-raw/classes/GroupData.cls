public inherited sharing class GroupData {
    
    public static List<Group> fetchQueues(set<String> queueNameSet, String Type){
        return [SELECT Id, Name,DeveloperName
                FROM Group 
                WHERE Name IN :queueNameSet and Type=: Type];
            }
    
}