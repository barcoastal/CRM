@isTest
public class GroupDataTest {
    @testSetup
    static void makeData(){
       Group grp =  DataFactoryTest.createQueueGroup();
        insert grp;
    }

    @isTest
    static void testfetchQueues(){
        Group grp = [Select id,Name,Type from Group where Type=:'QUEUE' limit 1];
        set<String> queueNameSet = new Set<String>{grp.Name};
            List<Group> grpList = GroupData.fetchQueues(queueNameSet,grp.Type);
        assert.isNotNull(!grpList.isEmpty(), 'group list should not be empty');
    }
}