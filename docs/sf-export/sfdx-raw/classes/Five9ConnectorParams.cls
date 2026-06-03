public with sharing class Five9ConnectorParams {
  
   private String ani;
   private String attemptCount; 
   private String agentFullName;
   private String callId;
   private String campaignName;
   private String dialerGroup;
   private String dispositionName;
   private String callEndTimeStamp;
   private String f9LastDisposition;
   private String f9LastDispositionDate;
   private String callHandleTime;
   private String callHoldTime;
   private String language;
   private String leadId;
   private String callLength;
   private String phoneNumber;
   private String opportunityId; 
   private String sessionId;
   private String skillName;
   private String callStartTimeStamp;
   private String userName;
   private String agentId;
   private String dnis;
   private String callType; 

    @testVisible
    private Map<String, String> params;
    
    public Five9ConnectorParams() {
        params = new Map<String, String>();
    }
    
    public Five9ConnectorParams(Map<String, String> requestParams) {
        params = requestParams; 
    }
    
    public String getAni() {
        return params.get('ANI');
    }

    public void setAni(String ani) {
        params.put('ANI', ani);
    }

    public String getAttemptCount() {
        return params.get('attempt_count');
    }

    public void setAttemptCount(String attemptCount) {
        params.put('attempt_count', attemptCount);
    }

    public String getAgentFullName() {
        return params.get('full_name');
    }

    public void setAgentFullName(String agentFullName) {
        params.put('full_name', agentFullName);
    }

    public String getCallId() {
        return params.get('call_id');
    }

    public void setCallId(String callId) {
        params.put('call_id', callId);
    }

    public String getCampaignName() {
        return params.get('campaign_name');
    }

    public void setCampaignName(String campaignName) {
        params.put('campaign_name', campaignName);
    }

    public String getDialerGroup() {
        return params.get('Dialer Group');
    }

    public void setDialerGroup(String dialerGroup) {
        params.put('Dialer Group', dialerGroup);
    }

    public String getDispositionName() {
        return params.get('disposition_name');
    }

    public void setDispositionName(String dispositionName) {
        params.put('disposition_name', dispositionName);
    }

    public String getCallEndTimeStamp() {
        return params.get('end_timestamp');
    }

    public void setCallEndTimeStamp(String callEndTimeStamp) {
        params.put('end_timestamp', callEndTimeStamp);
    }

    public String getF9LastDisposition() {
        return params.get('f9_last_disposition');
    }

    public void setF9LastDisposition(String F9LastDisposition) {
        params.put('f9_last_disposition', F9LastDisposition);
    }

    public String getF9LastDispositionDate() {
        return params.get('f9_last_disposition_date');
    }

    public void setF9LastDispositionDate(String F9LastDispositionDate) {
        params.put('f9_last_disposition_date', F9LastDispositionDate);
    }

    public String getCallHandleTime() {
        return params.get('handle_time');
    }

    public void setCallHandleTime(String callHandleTime) {
        params.put('handle_time', callHandleTime);
    }

   
    public String getOpportunityId() {
        return params.get('opportunity_id');
    }

    public void setOpportunityId(String opportunityId) {
        params.put('opportunity_id', opportunityId);
    }

    public String getSessionId() {
       return params.get('session_id');
    }

    public void setSessionId(String sessionId) {
        params.put('session_id', sessionId);
    }

    public String getSkillName() {
       return params.get('skill_name');
    }

    public void setSkillName(String skillName){
        params.put('skill_name', skillName);
    }

    public String getCallStartTimeStamp() {
       return params.get('start_timestamp');
    }

    public void setCallStartTimeStamp(String callStartTimeStamp) {
        params.put('start_timestamp', callStartTimeStamp);
    }

    public String getUserName() {
       return params.get('user_name');
    }

    public void setUserName(String userName) {
        params.put('user_name', userName);
    }

    public  String getAgentId() {
       return params.get('agent_id');
    }

    public void setAgentId(String agentId) {
        params.put('agent_id', agentId);
    }

 public String getCallHoldTime() {
        return params.get('hold_time');
    }

    public void setCallHoldTime(String callHoldTime) {
        params.put('hold_time', callHoldTime);
    }

    public String getLanguage() {
        return params.get('language');
    }

    public void setLanguage(String language) {
        params.put('language', language);
    }

    public String getLeadId() {
        return params.get('leadId');
    }

    public void setLeadId(String leadId) {
        params.put('leadId', leadId);
    }

    public String getCallLength() {
        return params.get('length');
    }

    public void setCallLength(String callLength) {
        params.put('length', callLength);
    }

    public String getPhoneNumber() {
        return params.get('number');
    }

    public void setPhoneNumber(String phoneNumber) {
        params.put('number', phoneNumber);
    }

    public void setDNIS(String dnis) {
        params.put('DNIS', dnis);
    }

    public  String getDNIS() {
        return params.get('DNIS');
     }

     public void setCallType(String callType){
        params.put('type_name', callType);
     }

     public String getCallType(){
        return params.get('type_name');
     }


}