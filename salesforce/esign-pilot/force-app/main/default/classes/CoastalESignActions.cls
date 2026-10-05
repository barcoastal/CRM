public with sharing class CoastalESignActions {
    @AuraEnabled public static void applyAction(Id recordId, String action, String reason) {
        if(action!='resend' && action!='void') throw new AuraHandledException('Unsupported envelope action.');
        if(action=='void' && String.isBlank(reason)) throw new AuraHandledException('Enter a reason for voiding.');
        // Reuse the authorized, sandbox-only sender session and record access checks.
        String senderUrl=CoastalESignPilotController.openSender(recordId);
        String packetId=senderUrl.substringAfter('/salesforce-sign/').substringBefore('#');
        String token=senderUrl.substringAfter('#');
        if(!Pattern.matches('sfp_[a-f0-9]{40}',packetId) || String.isBlank(token)) throw new AuraHandledException('Invalid sender session.');
        HttpRequest req=new HttpRequest();
        req.setEndpoint('callout:Coastal_ESign_Pilot/api/esign/packets/'+packetId+'/'+action);
        req.setMethod('POST');req.setTimeout(120000);
        req.setHeader('Authorization','Bearer '+token);req.setHeader('Content-Type','application/json');
        if(action=='void') req.setBody(JSON.serialize(new Map<String,Object>{'reason'=>reason.trim()}));
        HttpResponse response=new Http().send(req);
        if(response.getStatusCode()>=300) {
            String message='Unable to '+action+' the envelope. Please refresh and retry.';
            try { Map<String,Object> body=(Map<String,Object>)JSON.deserializeUntyped(response.getBody()); if(body.get('error')!=null) message=String.valueOf(body.get('error')); } catch(Exception e) {}
            throw new AuraHandledException(message);
        }
    }
}
