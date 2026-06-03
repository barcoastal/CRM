@isTest
private class Five9ConnectorParamsTest {

   private static User getUser() {
        Profile p = [SELECT Id FROM profile WHERE name='Standard User'];
        String orgId = UserInfo.getOrganizationId();
        String dateString = String.valueof(Datetime.now()).replace(' ','').replace(':','').replace('-','');
        Integer randomInt = Integer.valueOf(math.rint(math.random()*1000000));
        String uniqueName = orgId + dateString + randomInt;
        User user = new User();
        user.FirstName = 'Test';
        user.LastName = 'User';
        user.ProfileId = p.id; 
        user.Email = 'testuser@gmailtest.com'; 
        user.UserName = uniqueName+'testuser@gmailtest.com';
        user.Alias = uniqueName.substring(18,23);
        user.EmailEncodingKey = 'ISO-8859-1';
        user.TimeZoneSidKey = 'America/Los_Angeles';
        user.LocaleSidKey = 'en_US';
        user.LanguageLocaleKey = 'en_US';

        insert user; 

        return user;
    }

@isTest
    private static void testGetAni() {
        System.runAs(getUser()){
            Five9ConnectorParams five9Request = new Five9ConnectorParams();
            five9Request.setAni('5675674567');

            Test.startTest();
            String ani = five9Request.getAni();
            Test.stopTest();

            System.assertEquals('5675674567', ani, 'ANI should match the value in the params map');
        }
    }

    @IsTest
    private static void testGetDNIS() {
        System.runAs(getUser()){
            Five9ConnectorParams five9Request = new Five9ConnectorParams();
            five9Request.setDNIS('5675675678');

            Test.startTest();
            String dnis = five9Request.getDNIS();
            Test.stopTest();

            System.Assert.areEqual('5675675678', dnis, 'DNIS should match when ANI is present');
        }
    }
    
    @IsTest
    private static void testGetAttemptCount() {
        System.runAs(getUser()){
            Five9ConnectorParams five9Request = new Five9ConnectorParams();
           five9Request.setAttemptCount('5675675678');

            Test.startTest();
            String attemptCont = five9Request.getAttemptCount();
            Test.stopTest();

            System.Assert.areEqual('5675675678', attemptCont, 'DNIS should match when ANI is present');
        }
    }


    @IsTest
    private static void testGetAgentFullName() {
        System.runAs(getUser()){
            Five9ConnectorParams five9Request = new Five9ConnectorParams();
           five9Request.setAgentFullName('Test Use Case');

            Test.startTest();
            String fullName = five9Request.getAgentFullName();
            Test.stopTest();

            System.Assert.areEqual('Test Use Case', fullName, 'Agent Full Name should be match when Full Name is present');
        }
    }

    @IsTest
    private static void testGetCallId() {
        System.runAs(getUser()){
            Five9ConnectorParams five9Request = new Five9ConnectorParams();
           five9Request.setCallId('ll00cjcjcdjjdjeeieeo');

            Test.startTest();
            String callId = five9Request.getCallId();
            Test.stopTest();

            System.Assert.areEqual('ll00cjcjcdjjdjeeieeo', callId, 'Call Id should be match when call Id is present');
        }

    }

    @IsTest
    private static void testGetCampaignName() {
        System.runAs(getUser()){
            Five9ConnectorParams five9Request = new Five9ConnectorParams();
           five9Request.setCampaignName('Test campaign');

            Test.startTest();
            String campaignName = five9Request.getCampaignName();
            Test.stopTest();

            System.Assert.areEqual('Test campaign', campaignName, 'Campaign Name should be match when Campaign Name is present');
        }

    }

    //Dialer Group
    @IsTest
    private static void testGetDialerGroupName() {
        System.runAs(getUser()){
            Five9ConnectorParams five9Request = new Five9ConnectorParams();
           five9Request.setDialerGroup('Test Dialer Group');

            Test.startTest();
            String dialerGroupName = five9Request.getDialerGroup();
            Test.stopTest();

            System.Assert.areEqual('Test Dialer Group', dialerGroupName, 'Campaign Name should be match when Campaign Name is present');
        }
    }

        //disposition_name
        @IsTest
        private static void testGetDispositionName() {
        System.runAs(getUser()){
            Five9ConnectorParams five9Request = new Five9ConnectorParams();
            five9Request.setDispositionName('Test disposition name');

            Test.startTest();
            String dispositionName = five9Request.getDispositionName();
            Test.stopTest();

            System.Assert.areEqual('Test disposition name', dispositionName, 'Campaign Name should be match when Campaign Name is present');
        }
    }

    //end_timestamp
    @IsTest
    private static void testGetCallEndTimeStamp() {
        System.runAs(getUser()){
            Five9ConnectorParams five9Request = new Five9ConnectorParams();
            String callTime = System.dateTime.now().toString();
            five9Request.setCallEndTimeStamp(callTime);

            Test.startTest();
            String callEndTimeStamp = five9Request.getCallEndTimeStamp();
            Test.stopTest();

            System.Assert.areEqual(callTime, callEndTimeStamp, 'Call End Time Stamp should be match when there is value for call end time stamp');
        }
    }


    //f9_last_disposition

    @IsTest
    private static void testGetLastDisposition() {
        System.runAs(getUser()){
            Five9ConnectorParams five9Request = new Five9ConnectorParams();
           five9Request.setF9LastDisposition('Test disposition');

            Test.startTest();
            String lastDisposition = five9Request.getF9LastDisposition();
            Test.stopTest();

            System.Assert.areEqual('Test disposition', lastDisposition, 'Last Disposition should be match when last disposition is present');
        }
    }


    //getF9LastDisposition
    @IsTest
    private static void testGetF9LastDisposition() {
        System.runAs(getUser()){
            Five9ConnectorParams five9Request = new Five9ConnectorParams();
            five9Request.setF9LastDisposition('Test last disposition');

            Test.startTest();
            String lastDisposition = five9Request.getF9LastDisposition();
            Test.stopTest();

            System.Assert.areEqual('Test last disposition', lastDisposition, 'Last Disposition should be match when last disposition is present');
        }
    }

    //getF9LastDispositionDate
    @IsTest
    private static void testGetF9LastDispositionDate() {
        System.runAs(getUser()){
            String dispositionDate = System.Date.today().toString();
            Five9ConnectorParams five9Request = new Five9ConnectorParams();
            five9Request.setF9LastDispositionDate(dispositionDate);

            Test.startTest();
            String lastDispositionDate = five9Request.getF9LastDispositionDate();
            Test.stopTest();

            System.Assert.areEqual(dispositionDate, lastDispositionDate, 'Last Disposition Date should be match when last disposition date is present');
        }
    }

    //getCallHandleTime
    @IsTest
    private static void testGetCallHandleTime() {
        System.runAs(getUser()){    
            Five9ConnectorParams five9Request = new Five9ConnectorParams();
            five9Request.setCallHandleTime('11111');

            Test.startTest();
            String callHandleTime = five9Request.getCallHandleTime();   
            Test.stopTest();

            System.Assert.areEqual('11111', callHandleTime, 'Call Handle time should be match when call handle time is present');
        }
    }

    

     //language
     @IsTest
    private static void testGetLanguage() {
        System.runAs(getUser()){
            Five9ConnectorParams five9Request = new Five9ConnectorParams();
            five9Request.setLanguage('English');

            Test.startTest();   
            String language = five9Request.getLanguage();
            Test.stopTest();

            System.Assert.areEqual('English', language, 'Language should be match when language is present');
        }
    } 

    //leadId
   

        @IsTest
        private static void testGetLeadId() {
            System.runAs(getUser()){
                Five9ConnectorParams five9Request = new Five9ConnectorParams(); 
                five9Request.setLeadId('leadId');

                Test.startTest();
                String leadId = five9Request.getLeadId();
                Test.stopTest();

                System.Assert.areEqual('leadId', leadId, 'leadId should be match when leadId is present');
            }
        }

        @IsTest
        private static void testGetCallLength() {
            System.runAs(getUser()){
                Five9ConnectorParams five9Request = new Five9ConnectorParams();    
                five9Request.setCallLength('4512');       

                Test.startTest();
                String callLength = five9Request.getCallLength();
                Test.stopTest();

                System.Assert.areEqual('4512', callLength, 'callLength should be match when callLength is present');
            }
        }

        @IsTest
        private static void testGetPhoneNumber() {
            System.runAs(getUser()){
                Five9ConnectorParams five9Request = new Five9ConnectorParams();
                five9Request.setPhoneNumber('7894561245');

                Test.startTest();
                String phoneNumber = five9Request.getPhoneNumber();

                Test.stopTest();    
            
                System.Assert.areEqual('7894561245', phoneNumber, 'Phone Number should be match when Phonenumber is present');
            }
        }


         @IsTest
        private static void testGetOpportunityId() {
            System.runAs(getUser()){
                Five9ConnectorParams five9Request = new Five9ConnectorParams();
                five9Request.setOpportunityId('00Q123yuiUIOujQWEJ');

                Test.startTest();
                String opportunityId = five9Request.getOpportunityId();
                Test.stopTest();

                System.Assert.areEqual('00Q123yuiUIOujQWEJ', opportunityId, 'opportunityId should be match when opportunityId is present');
            }
        }

         @IsTest
        private static void testGetSkillName() {
            System.runAs(getUser()){
                Five9ConnectorParams five9Request = new Five9ConnectorParams();
                five9Request.setSkillName('Test Skill Name');

                Test.startTest();
                String skillName = five9Request.getSkillName();
                Test.stopTest();

                System.Assert.areEqual('Test Skill Name', skillName, 'Skill names should be match when opportunityId is present');
            }
        }




     @TestSetup
     static void testGetUserName(){
        
        System.runAs(getUser()){
            Five9ConnectorParams five9Request = new Five9ConnectorParams();
            five9Request.setUserName('TestUsername@coastaltest.com');

            Test.startTest();
            String username = five9Request.getUserName();
            Test.stopTest();

            System.Assert.areEqual('TestUsername@coastaltest.com', username, 'username should be match when opportunityId is present');



        }

     }

      @IsTest
      private static void testGetAgentId() {
          System.runAs(getUser()){
              Five9ConnectorParams five9Request = new Five9ConnectorParams();
              five9Request.setAgentId('123456789');

              Test.startTest();
              String agentId = five9Request.getAgentId();
              Test.stopTest();

              System.Assert.areEqual('123456789', agentId, 'agentId should be match when agentId is present');
          }
        }


        //getSessionId

        @IsTest
        private static void testGetSessionId() {
            System.runAs(getUser()){
                Five9ConnectorParams five9Request = new Five9ConnectorParams();
                five9Request.setSessionId('123456789');

                Test.startTest();
                String sessionId = five9Request.getSessionId();
                Test.stopTest();

                System.Assert.areEqual('123456789', sessionId, 'sessionId should be match when sessionId is present');
            }
        }


        //callStartTimeStamp

        @IsTest
         private static void testGetCallStartTimeStamp() {
             System.runAs(getUser()){
                 Five9ConnectorParams five9Request = new Five9ConnectorParams();
                 five9Request.setCallStartTimeStamp('123456789');

                 Test.startTest();
                 String callStartTimeStamp = five9Request.getCallStartTimeStamp();
                 Test.stopTest();

                 System.Assert.areEqual('123456789', callStartTimeStamp, 'callStartTimeStamp should be match when callStartTimeStamp is present');
             }
         }


         //getCallHoldTime

         @IsTest
         private static void testGetCallHoldTime() {
              System.runAs(getUser()){
                  Five9ConnectorParams five9Request = new Five9ConnectorParams();
                  five9Request.setCallHoldTime('123456789');
                  Test.startTest();
                  String callHoldTime = five9Request.getCallHoldTime();
                  Test.stopTest();

                  System.Assert.areEqual('123456789', callHoldTime, 'callHoldTime should be match when callHoldTime is present');
              }
          }
          
          @IsTest
          public static void testFive9Connector(){
            
            Map<String,String> params = new Map<String, String>(); 
            params.put('ANI','8459638522');
            User userRecord = getUser();
            System.runAs(userRecord){
            Test.startTest();
            Five9ConnectorParams fiveParams = new Five9ConnectorParams(params);
                                               
            Test.stopTest();
            System.assertEquals('8459638522', fiveParams.getAni(), 'ANI should be match the value in the params map');
            }
        }




        @IsTest
        private static void testGetCallType() {
            System.runAs(getUser()){
                Five9ConnectorParams five9Request = new Five9ConnectorParams();
                five9Request.setCallType('Phone');

                Test.startTest();
                String callType = five9Request.getCallType();
                Test.stopTest();

                System.Assert.areEqual('Phone', calltype, 'CallType should be match when CallType is present');
            }
        }
    }