import unittest
from device_pid import choose_pid, PACKAGE

class ProcessSelectionRegression(unittest.TestCase):
    def test_secondary_process_not_selected_as_game(self):
        self.assertEqual(choose_pid([102,101],{102:PACKAGE+':sandbox\0',101:PACKAGE+'\0'},''),101)
    def test_duplicate_names_use_activity_owner(self):
        self.assertEqual(choose_pid([102,101],{102:PACKAGE,101:PACKAGE},'ACTIVITY '+PACKAGE+'/com.activision.game.MainActivity abc pid=101\n'),101)
    def test_ambiguous_instances_are_not_guessed(self):
        with self.assertRaises(RuntimeError):choose_pid([101,102],{101:PACKAGE,102:PACKAGE},'')
    def test_single_instance_remains_compatible(self):
        self.assertEqual(choose_pid([101],{},''),101)

if __name__=='__main__':unittest.main()
