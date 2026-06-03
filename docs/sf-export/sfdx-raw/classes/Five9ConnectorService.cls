@RestResource(urlMapping='/Five9ConnectorService/*')
global without sharing class Five9ConnectorService {
   
    @HttpPost
    global static String doPost() {
        RestRequest req = RestContext.request;
        RestResponse res = RestContext.response;  

        //Map<String,String> params = req.params; 
        Five9ConnectorParams params = new Five9ConnectorParams(req.params);
        String ani = params.getAni();
        String attemptCount = params.getAttemptCount();  
        String agentFullName = params.getAgentFullName();
        String callId = params.getCallId();
        String campaignName = params.getCampaignName(); 
        String dialerGroup = params.getDialerGroup(); 
        String dispositionName = params.getDispositionName(); 
        String callEndTimeStamp = params.getCallEndTimeStamp(); 
        String f9LastDisposition = params.getF9LastDisposition(); 
        String f9LastDispositionDate = params.getF9LastDispositionDate();
        String callHandleTime = params.getCallHandleTime();
        String callHoldTime = params.getCallHoldTime();
        String language = params.getLanguage();
        String leadId = params.getLeadId(); 
        String callLength = params.getCallLength();
        String phoneNumber = params.getPhoneNumber(); 
        String opportunityId = params.getOpportunityId();
        String sessionId = params.getSessionId(); 
        String skillName = params.getSkillName();
        String callStartTimeStamp = params.getCallStartTimeStamp();
        String userName = params.getUserName();
        String agentId = params.getAgentId();
        String dnis = params.getDNIS(); 
        String callType = params.getCallType(); 

        String message = '';
        try {

            five9_Call_Log__c callLog = new five9_Call_Log__c();

            if(ani != null && dnis != null){
               
               callLog.ANI__c = ani;
               callLog.Attempt_Count__c = attemptCount; 
               callLog.Agent_Full_Name__c = agentFullName; 
               callLog.Call_Id__c = callId; 
               callLog.Caller_Language__c = language; 
               callLog.Campaign_Name__c = campaignName; 
               callLog.Disposition__c = dispositionName;
               callLog.DNIS__c = dnis;
               callLog.f9_Call_End_DateTime__c = callEndTimeStamp;
               callLog.f9_Call_Handle_Time__c = callHandleTime;
               callLog.f9_Call_Start_DateTime__c = callStartTimeStamp; 
               callLog.f9_last_disposition__c = f9LastDisposition; 
               callLog.f9_Last_Disposition_Date__c = f9LastDispositionDate;
               callLog.Lead_Id__c = leadId;
               callLog.Call_ID__c = callId;
               callLog.opportunity_id__c = opportunityId; 
               callLog.IVR_Script_Name__c = 'Five9 Connector';
               callLog.Session_Id__c = sessionId;
               callLog.Agent_Username__c = userName; 
               callLog.f9_Call_Type__c = callType; 
               
               Lead leadRecord = new Lead();
               if (leadId !=null && leadId !='') {
                   leadRecord = getLeadRecord(leadId);                 
                   if (leadRecord !=null && !leadRecord.isConverted) {
                       callLog.Lead__c = leadId;
                   }
               }

               if (opportunityId !=null && opportunityId !='') {
                   callLog.Opportunity__c = opportunityId;
               }else if(leadRecord !=null && leadRecord.isConverted){
                   callLog.Opportunity__c = leadRecord.ConvertedOpportunityId;
               }
               insert callLog;
           }

           message = 'Call Log Id: '+callLog.Id;

        } catch (Exception e) {
            ApplicationLogger.logException('Five9Connector', leadId, e.getMessage());
        }
        
        return message;
    }

    private static Lead getLeadRecord(String leadId) {
        List<Lead> leadRecords = new List<Lead>();
        List<String> leadFields = new List<String>{'Id', 'Email', 'Phone','isConverted','Lead_Id__c','ConvertedOpportunityId'};
        Id lId;
        if (leadId != null) {
           
            try {
             leadRecords = LeadData.queryLeadDetails(leadId,leadFields);
            } catch (Exception e) {
                ApplicationLogger.logException('Five9Connector GetLeadRecord', null, e.getMessage());
            }

        if (leadRecords.size()>0) {
            return leadRecords[0];
        } else {
            return null;
        }

     }

      return null; 
    }


}