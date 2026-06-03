/**
 * @Description : utility class for SMS object. Have methods which are relvant to this object. For example: createSMS()
 */ 
public class SMSObjectUtility {
    
    /**
     * @Description: Utility method to create SMS__C record with Is_Inbound__c = true
     * 
     */ 

    public static List<SMS__C> createInboundSMS(List<TwilioSMSWrapper> inboundSMSList){
        
        List<SMS__c> smsRecordInbound = new List<SMS__c>(); 
        for(TwilioSMSWrapper smsWrapper : inboundSMSList){
            
            SMS__c sms = new SMS__c(); 
            sms.From_Phone__c = smsWrapper.fromPhone; 
            sms.To_Phone__c = smsWrapper.toPhone; 
            sms.Message_Body__c = smsWrapper.messageBody; 
            sms.Is_Inbound__c = true; 
            smsRecordInbound.add(sms);
        }
        
        return smsRecordInbound; 
    }
    
    /**
     * @Description: Utility method to create SMS__C record with Is_Inbound__c = true
     * 
     */ 
    public static SMS__C createInboundSMS(TwilioSMSWrapper inboundSMS){
                    
            SMS__c sms = new SMS__c(); 
            sms.From_Phone__c = inboundSMS.fromPhone; 
            sms.To_Phone__c = inboundSMS.toPhone; 
            sms.Message_Body__c = inboundSMS.messageBody; 
            sms.Is_Inbound__c = true; 
        
            insert sms; 
        
        return sms; 
    }
    
    /**
     * @Description: Utility method to create SMS__C record with Is_Inbound__c = false
     * 
     */ 
    public static SMS__C createOutboundSMS(TwilioSMSWrapper outboundSMS){
                    
            SMS__c sms = new SMS__c(); 
            sms.From_Phone__c = outboundSMS.fromPhone; 
            sms.To_Phone__c = outboundSMS.toPhone; 
            sms.Message_Body__c = outboundSMS.messageBody; 
            sms.Is_Inbound__c = false; 
        
            insert sms; 
        
        return sms; 
    }
}