@isTest
public class OutboundAniHandlerTest {
    
    @isTest
    static void testPerformCallout() {
        LeadTriggerHandler.preventRecursion = true;
        Test.startTest();
            List<Lead> leadsToInsert = new List<Lead>{
                new Lead(FirstName='John', LastName='Doe', Company='Acme Inc.', Phone='9876543201', PostalCode='1123'),
                new Lead(FirstName='Jane', LastName='Doe', Company='Acme Inc.', Phone='9876543201', PostalCode='1123')
            };
            insert leadsToInsert;     
            Test.setMock(HttpCalloutMock.class, new OutboundAniMockHttpResponseGenerator(leadsToInsert[0].Id));  
        	OutboundAniHandler.performCallout(new Set<Id>{leadsToInsert[0].Id,leadsToInsert[1].Id});
        	OutboundAniHandler.throwExceptionForTest = true;
        	OutboundAniHandler.performCallout(new Set<Id>{leadsToInsert[0].Id,leadsToInsert[1].Id});
        Test.stopTest();
        
        List<Lead> leadDetails = [SELECT Id, Outbound_ANI__c FROM Lead WHERE Outbound_ANI__c != null];
		 //System.assertEquals(1, leadDetails.size());
    }
    @isTest
    static void testUpdateLeadRecordsBasedOnResult() {
        Lead testLead = new Lead(
            FirstName = 'Update',
            LastName = 'Check',
            Company = 'ANI Test Co'
        );
        insert testLead;
        
        String mockJson = '[{' +
            '"row_id":"' + testLead.Id + '",' +
            '"outboundani":"4087284658",' +
            '"43052dd1-b2e1-4e38-b607-b71daef3091b":"4087284658",' +
            '"409b1bbd-abdd-4377-abef-e4bfdf416ced":"2024-01-19 13:16:02",' +
            '"8b3f690b-0a7e-4b54-af6b-4783841a5d3d":"identifier-abc"' +
            '}]';
        
        
        Test.startTest();
        OutboundAniService.updateLeadRecordsBasedOnResult(mockJson);
        Test.stopTest();
	}

    public class OutboundAniMockHttpResponseGenerator implements HttpCalloutMock {
        private String rowId;
        
        public OutboundAniMockHttpResponseGenerator(String rowId) {
            this.rowId = rowId;
        }
        
        public HttpResponse respond(HttpRequest request) {
            HttpResponse response = new HttpResponse();
            response.setHeader('Content-Type', 'application/json');
            response.setBody('[{"row_id":"' + rowId + '","outboundani":"4087284658","43052dd1-b2e1-4e38-b607-b71daef3091b":"4087284658","409b1bbd-abdd-4377-abef-e4bfdf416ced":"2024-01-19 13:16:02","8b3f690b-0a7e-4b54-af6b-4783841a5d3d":"2c116abf-add9-4580-b677-a1384d2bf506","error":""}]');
            response.setStatusCode(200);
            return response;
        }
    }

}